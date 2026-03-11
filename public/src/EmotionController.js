export class EmotionController{

constructor(vrm){

this.vrm = vrm

}

setEmotion(name){

const emotions = [
"happy",
"sad",
"angry",
"surprised",
"neutral"
]

emotions.forEach(e=>{
this.vrm.expressionManager.setValue(e,0)
})

this.vrm.expressionManager.setValue(name,1)

}

}