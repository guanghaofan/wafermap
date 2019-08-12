/**
 * definition of customzied binning color for hygon
 *
 **/


export default class BinColors{
  constructor(){
    this._defaultColor = '#ff0000';
  }
  static getColor(binNumber){
    var color = this._defaultColor;
    switch (binNumber) {
      case '1001':
        color = "#ff9900";
        break;
      case '1002':
        color = "#00ff00";
        break;
      case '1003':
        color = "#ff00ff";
        break;
      case '1004':
        color = "#ff88ff";
        break;
      case '1005':
        color = "#00ffff";
        break;
      default:
        color = "#ff6666";
        break;
    }
    return color;

  }
  static getDefaultColor(){
    return this._defaultColor;
  }
}
