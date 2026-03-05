const { 
SlashCommandBuilder,
EmbedBuilder,
ActionRowBuilder,
StringSelectMenuBuilder,
ButtonBuilder,
ButtonStyle
} = require('discord.js');

const fs = require('fs');
const path = require('path');

module.exports = {
data: new SlashCommandBuilder()
.setName('perpus')
.setDescription('Buka Repository Digital Skripsi KG UNSRI'),

async execute(interaction) {

await interaction.deferReply();

const dbPath = path.join(__dirname, '../../data/skripsi_db.json');

let rawData = [];
let groupedData = {};

try {

const fileContent = fs.readFileSync(dbPath, 'utf8');
rawData = JSON.parse(fileContent);

rawData.forEach(item => {

const category = item.specialization || 'Lain-lain';

if (!groupedData[category]) {
groupedData[category] = [];
}

groupedData[category].push(item);

});

} catch (err) {

console.error(err);

return interaction.editReply(
'❌ Database Skripsi belum tersedia.'
);

}

const totalSkripsi = rawData.length;
const sortedCategories = Object.keys(groupedData).sort();

let statsText = "";

sortedCategories.forEach(cat => {

statsText += `• **${cat}**: ${groupedData[cat].length} judul\n`;

});

const embedMain = new EmbedBuilder()
.setColor(0x3498DB)
.setTitle('🏛️ PERPUSTAKAAN DIGITAL KG UNSRI')
.setDescription(
`Total dokumen: **${totalSkripsi}**

Pilih departemen di bawah ini.

${statsText}`
);

const menuOptions = sortedCategories.map(cat => ({

label: cat,
description: `${groupedData[cat].length} judul`,
value: cat,
emoji: '📂'

})).slice(0,25);

const selectMenu = new ActionRowBuilder().addComponents(

new StringSelectMenuBuilder()
.setCustomId('select_kategori')
.setPlaceholder('Pilih Departemen')
.addOptions(menuOptions)

);

const navButtons = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId('prev')
.setLabel('⬅️')
.setStyle(ButtonStyle.Primary)
.setDisabled(true),

new ButtonBuilder()
.setCustomId('home')
.setLabel('🏠')
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId('next')
.setLabel('➡️')
.setStyle(ButtonStyle.Primary)
.setDisabled(true)

);

const msg = await interaction.editReply({

embeds:[embedMain],
components:[selectMenu]

});

const collector = msg.createMessageComponentCollector({
time:600000
});

let currentCategory = null;
let currentPage = 0;
const ITEMS_PER_PAGE = 5;

collector.on('collect', async i => {

if (i.user.id !== interaction.user.id) {

return i.reply({
content:'Gunakan `/perpus` sendiri.',
ephemeral:true
});

}

if (i.isStringSelectMenu()) {

currentCategory = i.values[0];
currentPage = 0;

}

else if (i.isButton()) {

if (i.customId === 'prev') currentPage--;
if (i.customId === 'next') currentPage++;

if (i.customId === 'home') {

currentCategory = null;
currentPage = 0;

return i.update({
embeds:[embedMain],
components:[selectMenu]
});

}

}

if (currentCategory) {

const listData = groupedData[currentCategory];

const totalPages = Math.ceil(
listData.length / ITEMS_PER_PAGE
);

if (currentPage < 0) currentPage = 0;
if (currentPage >= totalPages) currentPage = totalPages - 1;

const start = currentPage * ITEMS_PER_PAGE;
const end = start + ITEMS_PER_PAGE;

const pageItems = listData.slice(start,end);

const listText = pageItems.map((item,index)=>{

const penulis = Array.isArray(item.authors)
? item.authors[0]
: item.authors || 'Tanpa Nama';

const tahun = item.year || '????';
const link = item.url || '#';

return `**${start+index+1}. [${item.title}](${link})**
👤 ${penulis} | 🗓️ ${tahun}`;

}).join('\n\n');

const embedList = new EmbedBuilder()
.setColor(0x2ECC71)
.setTitle(`📂 ${currentCategory}`)
.setDescription(listText)
.setFooter({
text:`Halaman ${currentPage+1}/${totalPages}`
});

const updatedButtons = new ActionRowBuilder().addComponents(

new ButtonBuilder()
.setCustomId('prev')
.setLabel('⬅️')
.setStyle(ButtonStyle.Primary)
.setDisabled(currentPage===0),

new ButtonBuilder()
.setCustomId('home')
.setLabel('🏠')
.setStyle(ButtonStyle.Secondary),

new ButtonBuilder()
.setCustomId('next')
.setLabel('➡️')
.setStyle(ButtonStyle.Primary)
.setDisabled(currentPage>=totalPages-1)

);

await i.update({

embeds:[embedList],
components:[selectMenu,updatedButtons]

});

}

});

collector.on('end', () => {

msg.edit({
content:'⚠️ Sesi perpustakaan ditutup.',
components:[]
});

});

}
};