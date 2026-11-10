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
  // Visual candidate map, NOT a trained pixel segmentation mask.
  // Brown/dark colour thresholds were checked against demonstration JPGs.
  // They may also highlight shadows, tray edges, or other brown substances.
  function visualMask(data,width,height){
    if(!data||!Number.isInteger(width)||!Number.isInteger(height)||
       width<1||height<1||data.length<width*height*4)
      throw Error("Invalid RGB frame for visual mask");
    var mask=new Uint8Array(width*height),count=0;
    var mx=Math.max(1,Math.floor(width*.018)),my=Math.max(1,Math.floor(height*.018));
    for(var y=my;y<height-my;y++)for(var x=mx;x<width-mx;x++){
      var p=y*width+x,i=4*p,r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;
      var brightness=.299*r+.587*g+.114*b;
      var brown=r>1.13*g&&r>1.16*b&&r>.10&&r<.81&&g<.62&&brightness<.63;
      var brownShadow=brightness<.29&&r>g*.95&&r>b*1.03;
      if(brown||brownShadow){mask[p]=1;count++;}
    }
    return {mask:mask,count:count,fraction:count/(width*height),method:"color-threshold-only"};
  }
  function validateModel(model){
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
    var publicRelay=(u.hostname==="ultron-sat.onrender.com" && u.pathname==="/camera/frame.jpg");
    if(!publicRelay && !/\/capture\/?$/i.test(u.pathname))
      throw Error("Camera URL must end in /capture, or use the ULTRON-SAT HTTPS relay");
    return u.href;
  }
  return {keys:KEYS,features:features,visualMask:visualMask,classify:classify,captureEndpoint:captureEndpoint};
});
