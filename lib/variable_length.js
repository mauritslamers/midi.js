var util = require('util');
// read a variable length value from position offset

exports.readVariableLength = function(buffer,offset){
  var byte;
  var ret = {
    value: 0,
    length: 0
  };
  for(var i=0;i<4;i+=1){
    byte = buffer.readUInt8(offset + ret.length);
    util.log('byte read is: ' + byte);
    ret.value = ret.value << 7;
    ret.value += (byte & 0x7F);
    ret.length += 1;
    if((byte & 0x80) !== 1){ // top bit not set, end of value
      i = 4; // force end      
    }
  }
  return ret;
};