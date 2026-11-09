/* Public, dependency-free ULTRON-SAT water-tray RGB appearance prototype.
   NOT the SAR oil model and NOT material-identity verification. */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  if(root) root.UltronWaterRGB=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  var KEYS=["dark_frac","brown_frac","very_dark_frac","brown_dark_frac"];
  function features(data,width,height){
    if(!data||data.length<width*height*4||width<1||height<1)throw Error("Invalid RGBA image");
    var dark=0,brown=0,veryDark=0,brownDark=0,total=width*height;
    for(var i=0;i<total;i++){
      var j=i*4,r=data[j]/255,g=data[j+1]/255,b=data[j+2]/255;
      var bright=.299*r+.587*g+.114*b;
      var isDark=bright<.44;
      var isBrown=r>1.13*g && r>1.16*b && r>.10 && r<.81 && g<.62;
      if(isDark)dark++;if(isBrown)brown++;
      if(bright<.25)veryDark++;
      if(isDark&&isBrown)brownDark++;
    }
    return [dark/total,brown/total,veryDark/total,brownDark/total];
  }
  function validateModel(model){
    if(!model||!model.not_oil_detection&&!model.verified_oil_detector===false){} // flags checked below
    if(!model||model.verified_oil_detector!==false||model.independent_test_accuracy!==null)
      throw Error("Only the reviewed experimental model is accepted");
    for(var k of ["mean","scale","coef"]){
      if(!Array.isArray(model[k])||model[k].length!==4||!model[k].every(Number.isFinite))
        throw Error("Incomplete model: "+k);
    }
    if(!model.scale.every(v=>v>0)||!Number.isFinite(model.intercept))throw Error("Invalid model scaling");
    return true;
  }
  function classify(values,model){
    validateModel(model);
    if(!Array.isArray(values)||values.length!==4||!values.every(Number.isFinite))throw Error("Invalid features");
    var z=model.intercept;
    for(var i=0;i<4;i++)z+=((values[i]-model.mean[i])/model.scale[i])*model.coef[i];
    var score=z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
    return {label:score>=.5?"Visible dark patch (experimental)":"No obvious dark patch",score:score,features:values,independentTested:false};
  }
  function captureEndpoint(input){
    var u;try{u=new URL(input);}catch(e){throw Error("Enter a complete HTTPS snapshot URL");}
    if(u.protocol!=="https:"||u.username||u.password)
      throw Error("Remote camera must use HTTPS without embedded credentials");
    if(!/\/capture\/?$/i.test(u.pathname))
      throw Error("Camera gateway URL must end in /capture");
    return u.href;
  }
  return {keys:KEYS,features:features,classify:classify,captureEndpoint:captureEndpoint};
});
