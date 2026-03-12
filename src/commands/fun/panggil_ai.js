const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');

const { GoogleGenAI, Modality, Type } = require('@google/genai');

const { getWavHeader } = require('../../utils/wav');

const { MilvusClient } = require("@zilliz/milvus2-sdk-node");

const User = require('../../models/User');
const Notebook = require('../../models/Notebook');

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const milvusClient = new MilvusClient({
    address: `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT}`,
    ssl: false
});

const searchMedicalTool = {
    functionDeclarations: [{
        name: "search_medical_reference",
        description: "Cari referensi medis kedokteran gigi",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING
                }
            },
            required: ["query"]
        }
    }]
};

module.exports = {

data: new SlashCommandBuilder()
.setName('panggil_ai')
.setDescription('Panggil VTuber AI Amamiya'),

async execute(interaction){

const member = interaction.member;
const voiceChannel = member.voice.channel;

if(!voiceChannel)
return interaction.reply("Masuk voice channel dulu.");

await interaction.reply("🎙️ Mengaktifkan Amamiya...");

const connection = joinVoiceChannel({

channelId: voiceChannel.id,
guildId: voiceChannel.guild.id,
adapterCreator: voiceChannel.guild.voiceAdapterCreator,
selfDeaf:false

});

const receiver = connection.receiver;

let session;

let audioChunks=[];
let textChunks=[];
let activeImages=[];

session = await ai.live.connect({

model:'models/gemini-2.5-flash-native-audio-preview-12-2025',

config:{

tools:[searchMedicalTool],

responseModalities:[
Modality.AUDIO,
Modality.TEXT
],

systemInstruction:{
parts:[{
text:`Kamu adalah Amamiya VTuber asisten medis FKG. Jawab cepat dan ramah.`
}]
},

speechConfig:{
voiceConfig:{
prebuiltVoiceConfig:{
voiceName:"Despina"
}
}
}

},

callbacks:{

onopen(){
console.log("Gemini connected");
},

async onmessage(message){

if(message.serverContent?.modelTurn?.parts){

for(const part of message.serverContent.modelTurn.parts){

if(part.inlineData?.data){

const pcm = Buffer.from(part.inlineData.data,"base64");

audioChunks.push(pcm);

}

if(part.text){

textChunks.push(part.text);

}

}

}

if(message.toolCall){

const call = message.toolCall.functionCalls[0];

if(call.name==="search_medical_reference"){

const query = call.args.query;

let hasil="Data tidak ditemukan.";

try{

const embed = await ai.models.embedContent({
model:'gemini-embedding-001',
contents:query
});

const vector=embed.embeddings[0].values;

const searchRes = await milvusClient.search({

collection_name:"notebook_amamiya",

vector,

limit:2,

output_fields:["text_content","page_number"]

});

if(searchRes.results.length>0){

hasil=searchRes.results.map(r=>
`Halaman ${r.page_number}: ${r.text_content}`
).join("\n\n");

}

}catch(e){

console.log(e);

}

session.sendClientContent({

toolResponse:{
functionResponses:[{

id:call.id,
name:call.name,
response:{result:hasil}

}]

}

});

}

}

if(message.serverContent?.turnComplete){

if(audioChunks.length>0){

const pcmBuffer = Buffer.concat(audioChunks);

const header = getWavHeader(pcmBuffer.length);

const wavBuffer = Buffer.concat([header,pcmBuffer]);

interaction.client.io.emit("ai_speak",{

audioData:wavBuffer.toString("base64"),

teks:textChunks.join(""),

emosi:"happy"

});

audioChunks=[];
textChunks=[];
activeImages=[];

}

}

},

onerror(e){

console.log("Gemini error",e);

},

onclose(e){

console.log("Gemini closed",e.reason);

}

}

});

receiver.speaking.on("start",(userId)=>{

if(userId!==interaction.user.id) return;

console.log("User speaking");

const audioStream = receiver.subscribe(userId,{
end:{
behavior:EndBehaviorType.AfterSilence,
duration:1000
}
});

const decoder = new prism.opus.Decoder({

rate:16000,
channels:1,
frameSize:320

});

const pcmStream = audioStream.pipe(decoder);

let buffer = Buffer.alloc(0);

pcmStream.on("data",(chunk)=>{

buffer = Buffer.concat([buffer,chunk]);

while(buffer.length>=320){

const frame = buffer.slice(0,320);

buffer = buffer.slice(320);

session.sendClientContent({

realtimeInput:{
mediaChunks:[{

mimeType:"audio/pcm;rate=16000",

data:frame.toString("base64")

}]

}

});

}

});

pcmStream.on("end",()=>{

console.log("User finished speaking");

session.sendClientContent({

realtimeInput:{
audioStreamEnd:true
}

});

});

});

}

};