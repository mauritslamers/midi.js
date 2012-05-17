/*globals Buffer*/

var readVariableLength = require('./variable_length').readVariableLength;
var util = require('util');


var sysexAuthorization = function(buffer,offset){
  // ignore first byte
  var pos = offset+1;
  var len = readVariableLength(buffer,pos);
  var buf = new Buffer(len.value);
  var start = pos + len.length;
  var end = start + len.value;
  buffer.copy(buf,0,start,end);
  return {
    type: 'sysexauthorization',
    data: buf,
    length: end - offset
  };
};

var sysexNormalOrDivided = function(buffer,offset){
  var pos = offset + 1, len, buffers = [], buf,ret;
  var keepRunning = true;
  while(keepRunning){
    len = readVariableLength(buffer,pos);
    pos += len.length;
    buf = new Buffer(len.value);
    buffer.copy(buf,0,pos,pos+len.value);
    pos += len.value;
    buffers.push(buf);
    //now check on last value
    if(buf.readUInt8(buf.length-1) === 0xF7) keepRunning = false; // end while
  }
  
  if(buffers.length === 1){ // normal sysex
    ret = {
      type: 'normalsysex',
      length: pos - offset,
      data: buffers[0]
    };
  }
  else {
    ret = {
      type: 'dividedsysex',
      length: pos-offset,
      data: buffers
    };
  }
  return ret;
};

exports.sysexEvent = function(buffer,offset){
  var pos = 0, sysexData;
  
  //ret.isMetaEvent = buffer.readUInt8(offset) === 0xFF;
  var ret = {
    isSysexEvent: true
  };
  
  var type = buffer.readUInt8(offset);
  if(type === 0xF7){
    sysexData = sysexAuthorization(buffer,offset);
  }
  else {
    // either normal or divided
    sysexData = sysexNormalOrDivided(buffer,offset);
  }
  
  for(var i in sysexData){
    if(sysexData.hasOwnProperty(i)){
      ret[i] = sysexData[i];
    }
  }
  return ret;
};