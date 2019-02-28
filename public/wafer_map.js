const d3 = require('d3');
//import d3 from 'd3';
//import d3Tip from "d3-tip"
//import { seedColors } from 'ui/vis/components/color/seed_colors';
import { EventEmitter } from 'events';
import BinColors from './BinColors';
import chrome from 'ui/chrome';

/**
const ORIENTATIONS = {
  'single': () => 0,
  'right angled': (tag) => {
    return hashWithinRange(tag.text, 2) * 90;
  },
  'multiple': (tag) => {
    return ((hashWithinRange(tag.text, 12)) * 15) - 90;//fan out 12 * 15 degrees over top-right and bottom-right quadrant (=-90 deg offset)
  }
};
const D3_SCALING_FUNCTIONS = {
  'linear': () => d3.scale.linear(),
  'log': () => d3.scale.log(),
  'square root': () => d3.scale.sqrt()
};
**/

class WaferMap extends EventEmitter {

  constructor(domNode, marginLeft, marginRight, marginTop, marginBottom, marginNeighbor) {

    super();

    //DOM
    this._marginLeft = marginLeft;
    this._marginBottom = marginBottom;
    this._marginTop = marginTop;
    this._marginRight = marginRight;
    this._marginNeighbor = marginNeighbor;
    this._element = domNode;
    this._size = [1, 1];
    
    /*
    this._d3SvgContainer = d3.select(this._element).append('svg');
    this._svgGroup = this._d3SvgContainer.append('g')
        .attr("transform", "translate(" + this._marginLeft + "," + this._marginTop + ")");
    

    this._tooltip = d3.select(this._element).append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);
      */
      
    /**************************************************************************************************/
  
 
    
    this._d3SvgContainer = d3.select(this._element).append('canvas')
      .attr('width', this._element.offsetWidth)
      .attr('height', this._element.offsetHeight);
    this._context = this._d3SvgContainer.node().getContext("2d");
    
    
    
    /*
    
     this._canvas = d3.select(document.createElement('canvas'))
      .attr('width', this._element.offsetWidth)
      .attr('height', this._element.offsetHeight);
     this._context = this._canvas.node().getContext('2d');
     
     
    //this._element.appendChild(this._canvas);
    
    //this._canvasContainer = d3.select(this._element).append('canvas');
    //this._canvasGroup = this._canvasContainer.append('g');
    
    //this._canvas = d3.select(document.createElement('canvas'));
    var canvas = d3.select(this._element)
      .append('canvas');

    var context = canvas.node().getContext('2d');
    
 
      
    this._canvasGroup = this._canvasContainer.append('g'); 
    
    this._context = this._canvasGroup.node().getContext('2d');
    */
    
    //this._context.translate(this._marginLeft, this._marginTop);
    
    
    //this._customBase = document.createElement('custom');
    //this._custom = d3.select(this._customBase); // this is your SVG replacement and the parent of all other elements
    
    
    this._groupSpacing = 4;
    this._cellSpacing = 2;
    //this._offsetTop = height / 5;
    //this._cellSize = Math.floor((width - 11 * groupSpacing) / 100) - cellSpacing;

    
    
    /**************************************************************************************************/


    //SETTING (non-configurable)
    this._fontFamily = 'Open Sans, sans-serif';
    this._fontStyle = 'normal';
    this._fontWeight = 'normal';
    this._spiral = 'archimedean';//layout shape
    this._timeInterval = 1000;//time allowed for layout algorithm
    this._padding = 5;

    //OPTIONS
    this._colorSchema = 'green-red';
    this._showLabel = false;
    this._reverseColor = false;
    this._addTooltip = false;
    this._colorScale = 'linear';

    //DATA
    this._words = null;
    this._minZ = 0;
    this._maxZ = 1;
    //this._xTitle = null;
    //this._yTitle = null;
    this._row = null;
    this._series = false;
    this._showRowY = false;
    this._showColumnX = false;
    this._colorBucket = 9;
    //this._colors = new Array(this._colorBucket);
    this._colorRange = null;
    //UTIL
    this._setTimeoutId = null;
    this._pendingJob = null;
    this._layoutIsUpdating = null;
    this._allInViewBox = false;
    this._DOMisUpdating = false;
    this._paramsOnly = false;
    //DATA
    this._x = null;
    this._y = null;
    this._showGrid = false;

    //color category
    this._colorCategory = {};

    //LAYOUT
    this._rowCnt = 1;
    this._columnCnt = 1;

    // defaultAxisOrientation
    this._defaultAxisOrientation = true;
    this._defaultXAxisOri = chrome.getInjected('defaultXAxisOrientation', false);
    this._defaultYAxisOri = chrome.getInjected('defaultYAxisOrientation', false);

    // default hard bin and soft bin name to support ordinal color
    this._defaultSBinName = chrome.getInjected('defaultSoftBinName', false);
    this._defaultHBinName = chrome.getInjected('defaultHardBinName', false);

    // default hard bin and soft bin customized color settings in kibana.yml
    // format:

    this._defaultSBinColorStr = chrome.getInjected('defaultSoftBinColor', false);
    this._defaultHBinColorStr = chrome.getInjected('defaultHardBinColor', false);

    this._defaultSBColors = new Map();
    this._defaultHBColors = new Map();

    if (this._defaultSBinColorStr.length > 3) {
      var no = 0;
      var tmpColors = this._defaultSBinColorStr.split(":");
      for(;no != tmpColors.length; no ++){
        var binColor = tmpColors[no];
        this._defaultSBColors.set(binColor.split("-")[0], binColor.split("-")[1]);
      }
    }

    if (this._defaultHBinColorStr.length > 3) {
      var no = 0;
      var tmpColors = this._defaultHBinColorStr.split(":");
      for(;no != tmpColors.length; no ++){
        var binColor = tmpColors[no];
        this._defaultHBColors.set(binColor.split("-")[0], binColor.split("-")[1]);
      }
    }
  }

  setOptions(options, paramsOnly) {

    if (JSON.stringify(options) === this._optionsAsString) {
      return;
    }
    this._optionsAsString = JSON.stringify(options);
    this._showLabel = options.showLabel;
    this._addTooltip = options.addTooltip;
    this._colorSchema = options.colorSchema;
    this._reverseColor = options.reverseColor;
    this._colorScale = options.colorScale;
    this._defaultAxisOrientation = options.defaultAxisOrientation;
    this._isCanvas = true;
  }

  setData(minZ, maxZ, x, y, data, row, series, colorCategory) {
    //this._x = [];
    //this._y = [];
    this._minZ = minZ;
    this._maxZ = maxZ;
    this._x = x;
    this._y = y;
    this._words = data;
    this._row = row;
    this._series =series;
    this._colorBucket = (colorCategory === 2 ? 1 : 9);
    //this._xTitle = xTitle;
    //this._yTitle = yTitle;
  }

  upateSVG() {
    console.log("******************* start update svg ***********************");
    this._invalidate(false);
  }
  clearSVG() {
    this._emptyDOM();
  }

  destroy() {
    clearTimeout(this._setTimeoutId);
    this._element.innerHTML = '';
  }

  getStatus() {
    return this._allInViewBox ? WaferMap.STATUS.COMPLETE : WaferMap.STATUS.INCOMPLETE;
  }

  _updateContainerSize() {
    
    this._d3SvgContainer.attr('width', this._element.offsetWidth);
    this._d3SvgContainer.attr('height', this._element.offsetHeight);
    //this._svgGroup.attr('width', this._element.offsetWidth);
    //this._svgGroup.attr('height', this._element.offsetHeight);
    
    this._context.clearRect(0, 0, this._element.offsetWidth, this._element.offsetHeight);
  }

  _isJobRunning() {
    return (this._setTimeoutId || this._DOMisUpdating);
  }

  async _processPendingJob() {
      await this._updateDOM();
      this.emit('renderComplete');
    

  }


  _emptyDOM() {
    //this._svgGroup.selectAll('*').remove();
    this._cloudWidth = 0;
    this._cloudHeight = 0;
    this._allInViewBox = true;
    this._DOMisUpdating = false;
  }

  async _updateDOM() {


    this._DOMisUpdating = true;

    /**
    const affineTransform = positionWord.bind(null, this._element.offsetWidth / 2, this._element.offsetHeight / 2);
    const svgTextNodes = this._svgGroup.selectAll('text');
    const stage = svgTextNodes.data(job.words, getText);
    **/

    await new Promise((resolve) => {
      const tableCnt = this._words.length;
      let xWidth = 0; // row mode for x coord
      let yHeight = 0; // column mode for y coord
      let cellHeight = 0;
      let cellWidth = 0;
      let chartWidth = 0; // = xWidth - neighbor
      let chartHeight = 0;
      let spaceCellCnt = 1.5;


      this._emptyDOM();


      this._colorRange = (this._colorSchema === 'Green-Red' ? ["#008000", "#FF0000"] :
                        this._colorSchema === 'Green-Blue' ? ["#008000", "#0000FF"] :
                        this._colorSchema === 'Green-Yellow' ? ["#008000", "#FFFF00"] :
                        this._colorSchema === 'Green-Orange' ? ["#008000", "#FFA500"] :
                        this._colorSchema === 'Yellow-Pink' ? ["#FFFF00", "#FFC0CB"] :
                        this._colorSchema === 'LightGreen-SkyBlue' ? ["#90EE90", "#87CEEB"] :
                        this._colorSchema === 'DarkGreen-Brown' ? ["#006400", "#A52A2A"] :
                        this._colorSchema === 'Green-Red-Yellow' ? ["#008000", "#FF0000", "#FFFF00"] :
                        this._colorSchema === 'Green-Yellow-Blue' ? ["#008000", "#FFFF00", "#0000FF"] :
                        this._colorSchema === 'Green-Yellow-Red' ? ["#008000", "#FFFF00", "#FF0000"] :
                        this._colorSchema === 'Green-Yellow-Pink' ? ["#008000", "#FFFF00", "#FFC0CB"] :
                        this._colorSchema === 'Green-Red-Blue' ? ["#008000", "#FF0000", "#0000FF"] :
                        this._colorSchema === 'Green-Pink-Yellow' ? ["#008000", "#FFC0CB", "#FFFF00"] :
                        ["#008000", "#FF0000"]
      );

      var colorScale = d3.scaleLinear()
        .domain(d3.range(0, 1, 1.0 / (this._colorRange.length)))
        .range(this._colorRange);
      var colorDomain = d3.scaleLinear().domain([this._minZ,this._maxZ]).range([0,1]);

      var tooltip = this._tooltip;
      var defaultAxisOrientation = this._defaultAxisOrientation;

      let tableNo = 0;
      let metricTitle = this._series ? this._words[tableNo].tables["0"].columns[2].title : this._words[tableNo].columns[2].title;
      const xTitle = this._series ? this._words[tableNo].tables["0"].columns[0].title : this._words[tableNo].columns[0].title;
      const yTitle = this._series ? this._words[tableNo].tables["0"].columns[1].title : this._words[tableNo].columns[1].title;
      const xIsAsc = (this._defaultXAxisOri === 'asc' ? true : false);
      const yIsDes = (this._defaultYAxisOri === 'des' ? true : false);

      const xAxisOrientationDefault = (xTitle.indexOf('Asc') === -1) ? false : true;
      const yAxisOrientationDefault = (yTitle.indexOf('Asc') === -1) ? true : false;

      let xTitleLength = xTitle.split(":")[0].length;
      let yTitleLength = yTitle.split(":")[0].length;
      let metricTitleLength = metricTitle.length;

      const maxX = this._x.length - 1;
      const maxY = this._y.length - 1;
      const reverseColor = this._reverseColor;
      const isRow = this._row;
      const isSeries = this._series;
      const yBase = this._element.offsetHeight - this._marginBottom - this._marginTop;

  const height = this._element.offsetHeight - this._marginTop - this._marginBottom;
  const width = this._element.offsetWidth - this._marginLeft - this._marginRight;
  console.log("width: " + width + ", height: " + height);

	if (tableCnt === 1) {
		this._columnCnt = 1;
		this._rowCnt = 1;
	}
	else {
        //here add code to sort the table by number, need to check the split by bucket here
        var ascend = true;
        var isWafer = true;
        if (this._words[0].title.indexOf('Asc') === -1) {
          ascend = false;
        }
        if (this._words[0].title.indexOf('WaferNumber') === -1) {
          isWafer = false;
        }
        if (this._words[0].aggConfig.params.orderBy == '_key') {
          this._words.sort(function (a, b){
            var numbera = + a.key;
            var numberb = + b.key;
            return ascend ? numbera > numberb : numberb > numbera;
          });
        }

	      let colBasedTotalCnt = 0;
	      let columnCnt = 0;
	      let rowCnt = 0;

	      while (columnCnt ++ < 50) {
		      rowCnt = (columnCnt * height / width);
		      if (rowCnt >= 1) {
			      rowCnt = Math.floor(rowCnt);
			      colBasedTotalCnt = columnCnt * rowCnt;
			      if (colBasedTotalCnt >= tableCnt) {
			        this._rowCnt = rowCnt;
			        this._columnCnt = columnCnt;
			        break;
			      }
		      }
	      }

	      let rowBasedTotalCnt = 0;
	      rowCnt = 0;
	      columnCnt = 0;
	      while (rowCnt ++ < 50) {
		      columnCnt = (rowCnt * width / height);
		      if (columnCnt >= 1) {
			      columnCnt = Math.floor(columnCnt);
			      rowBasedTotalCnt = columnCnt * rowCnt;
			      if (rowBasedTotalCnt >= tableCnt) {
			        if(rowBasedTotalCnt < colBasedTotalCnt) {
			          this._rowCnt = rowCnt;
			          this._columnCnt = columnCnt;
			        }
			        break;
			      }
		      }
		    }
      if(tableCnt < this._columnCnt) {
          this._columnCnt = tableCnt;
      }
      if(tableCnt < this._rowCnt) {
        this._rowCnt = tableCnt;
      }

  }
  chartHeight = height / this._rowCnt;
  chartWidth = width / this._columnCnt;

  cellHeight = (height / this._rowCnt - this._marginNeighbor) / (this._y.length + spaceCellCnt);
	cellWidth = (width / this._columnCnt - this._marginNeighbor) / (this._x.length + spaceCellCnt);
	
	console.log("cellHeight: " + cellHeight + ", cellWitdth: " + cellWidth);
	console.log("maxX: " + this._x.length + ", maxY: " + this._y);
	if (cellHeight < 10) {
	  if (this._colorBucket !== 2) {
			  this._colorBucket = 4;
		}
  }

  var isOrdinal = false;
  var isCustomziedBinning = false;

  var colorScale20 = d3.scaleOrdinal(d3.schemeCategory20);
  var colorScale20b = d3.scaleOrdinal(d3.schemeCategory20b);
  var colorScale20c = d3.scaleOrdinal(d3.schemeCategory20c);

  var isSoftBining = metricTitle.indexOf(this._defaultSBinName) === -1 ? false : true;
  var isHardBining = metricTitle.indexOf(this._defaultHBinName) === -1 ? false : true;
  var isBinning = (isSoftBining || isHardBining);

  var defaultSBColors = this._defaultSBColors;
  var defaultHBColors = this._defaultHBColors;

  if (this._colorScale === 'ordinal' && isBinning) {
    colorScale = colorScale20;
    isOrdinal = true;
  }
  else if (this._colorScale === 'customzied binning' && isBinning) {
    isCustomziedBinning = (isSoftBining && defaultSBColors.size > 0) || (isHardBining && defaultHBColors.size > 0);


    if (!isCustomziedBinning) {
      isSoftBining = false;
      isHardBining = false;
    }
  }
  var colorCategory = [];
  
  this._context.translate(this._marginLeft, this._marginTop);
  
  while (tableNo !== tableCnt) {
    let rowNo = Math.floor(tableNo / this._columnCnt);
    let ltx = (tableNo % this._columnCnt) / this._columnCnt * width;
    let lty = rowNo * (height / this._rowCnt);
    var context = this._context;
    var marginLeft = this._marginLeft; 
    var marginTop = this._marginTop;
    
    
      this._x.forEach(function(d, i){
        var i =  revertX(i, maxX, defaultAxisOrientation, xAxisOrientationDefault, xIsAsc);
        var x = (i) * cellWidth + ltx;
        var y = lty + (maxY + 1 + spaceCellCnt / 2) * cellHeight;
        var opacity = cellWidth >= 30 ? 1 : cellWidth >= 20 ? (d + 3) % 2 : (d + 3) % 3 === 0 ? 1 : 0;
        if(opacity === 1){
          drawText(context, d, x, y, cellWidth, cellHeight);
        }
      });
      
      if (this._series) {
        drawText(this._context, this._words[tableNo].title, ltx + maxX * cellWidth / 2, lty + chartHeight -this._marginNeighbor + 10, cellWidth, cellHeight);
      }
      
      if (tableNo % this._columnCnt === 0) {
        this._y.forEach(function(d, i){
          var i = revertY(i, maxY, defaultAxisOrientation, yAxisOrientationDefault, yIsDes);
          var y = (i) * cellHeight + lty;
          var x = 0;
          var opacity = cellHeight >= 30 ? 1 : cellHeight >= 20 ? (d + 3) % 2 : (d + 3) % 3 === 0 ? 1 : 0;
          if(opacity === 1) {
            drawText(context, d, x - cellWidth / 2 - 10, y, cellWidth, cellHeight);
          }
        });
      }
  
  
      /*
      var xLabels = this._svgGroup.selectAll("xLabel-" + tableNo)
            .data(this._x)
          xLabels.exit().remove();
          xLabels.enter().append("text")
            .text(function (d) { return d; })
            .style("text-anchor", "middle")
            .attr("dy", ".5em")
            .attr("class", "series-title")
            .attr("opacity", d=> {return cellWidth >= 15 ? 1 : cellWidth >= 10 ? (d + 3) % 2 : (d + 3) % 3 === 0 ? 1 : 0;})
            .attr("x", function (d, i) {
              i =  revertX(i, maxX, defaultAxisOrientation, xAxisOrientationDefault, xIsAsc);
              return (i + 0.5) * cellWidth + ltx;
            })
            .attr("y", function (d, i) {
              return lty + (maxY + 1 + spaceCellCnt / 2) * cellHeight;
           });

          if (this._series) {
            var xSeriesTitle = this._svgGroup.append("text")
             .text(this._words[tableNo].title)
             .attr("x",
               ltx + maxX * cellWidth / 2
             )
             .attr("y",
               lty + chartHeight -this._marginNeighbor
             )
             .attr("dy", "1em")
             .attr("class", "series-title")
             .style("text-anchor", "middle");
          }

      if (tableNo % this._columnCnt === 0) {
          var yLabels = this._svgGroup.selectAll(".yLabel-" + tableNo)
            .data(this._y);
          yLabels.exit().remove();
          yLabels.enter().append("text")
            .text(function (d) { return d; })
            .style("text-anchor", "end")
            .attr("class", "series-title")
            .attr("opacity", d=> {return cellHeight >= 15 ? 1 : cellHeight >= 10 ? (d + 3) % 2 : (d + 3) % 3 === 0 ? 1 : 0;})
            .attr("dy", ".5em")
            .attr("dx", "-0.5em")
            .attr("x",  function (d, i) {
              return (0);
            })
            .attr("y", function (d, i) {
              i = revertY(i, maxY, defaultAxisOrientation, yAxisOrientationDefault, yIsDes);
              return (i + 0.5) * cellHeight + lty;
            });
      }
     */
      
    
    if(this._isCanvas) {
    var data = this._series ? this._words[tableNo].tables["0"].rows : this._words[tableNo].rows;
        var context = this._context;

        data.forEach(function(d, i) {
          var temp = revertX(d[0], maxX, defaultAxisOrientation, xAxisOrientationDefault, xIsAsc);
          var x = (temp * cellWidth + ltx);
          
          temp = revertY(d[1], maxY, defaultAxisOrientation, yAxisOrientationDefault, yIsDes);
          var y= (temp * cellHeight + lty);
          context.beginPath();
          context.fillStyle=colorScale(i);
          context.fillRect(x, y, cellWidth, cellHeight);
          drawText(context, d[2], x, y, cellWidth, cellHeight);
          console.log("x= " + x + ", y = " +y);
          
          context.closePath();
        });
    
      /*
      var join = this._custom.selectAll('custom.rect').data(this._series ? this._words[tableNo].tables["0"].rows : this._words[tableNo].rows);
        
        console.log("ltx: " + ltx + ", lty: " + lty);
     
     
     var exitSel = join.exit()
        .transition()
        .attr('width', 0)
        .attr('height', 0)
        .remove();
        
      var enterSel = join.enter()
        .append('custom')
        .attr('class', 'rect')
        .attr("x", function(d, i) {
        
          var x = revertX(d[0], maxX, defaultAxisOrientation, xAxisOrientationDefault, xIsAsc);
          console.log('x:' + x + ",cellWidth:" + cellWidth + ",ltxt: " + ltx);
          console.log("x=x * cellWidth + ltx is:" + (x * cellWidth + ltx));
          return (x * cellWidth + ltx);
          
      
        })
        .attr("y", function(d, i) {
          var y = revertY(d[1], maxY, defaultAxisOrientation, yAxisOrientationDefault, yIsDes);
          return (y * cellHeight + lty);
       
        })
        .attr('width', 0)
        .attr('height', 0);
        
      join
        .merge(enterSel)
        .transition()
        .attr('width', cellWidth)
        .attr('height', cellHeight)
        .attr('fillStyle', function(d) { 
          var colorNo = 0;
            if (isOrdinal) {
              colorNo = getOrdinalColor(d[2], colorCategory);
              colorScale = d3.scale.category20();
              if (colorNo <= 19) {
                colorScale = colorScale20;
              }
              else if (colorNo <= 39) {
                colorScale = colorScale20b;
                colorNo -= 20;
              }
              else {
                colorScale = colorScale20c;
                colorNo -= 40;
              }
            }

            if (isCustomziedBinning) {
              colorNo = getOrdinalColor(d[2], colorCategory);
              var binColor = isSoftBining ? defaultSBColors.get(d[2]) : defaultHBColors.get(d[2]);
              if (binColor == null) {
                return 'RGB(0,0,0)';
              }
              return binColor;
            }
            else {
              return isOrdinal ? colorScale(colorNo) : colorScale(reverseColor ? 1 -  colorDomain(d[2]) : colorDomain(d[2]));
            }
        });
        this._drawCanvas(tableNo, cellWidth, cellHeight);
        */
  
        tableNo++;
    }
      
  }
      /*
      this._d3SvgContainer.onmousemove = function(event) {
          console.log(event);
          var _pagex = event.pageX;
          var _pagey = event.pageY;
          var _pageLengthX = (_pagex / 10) | 0;
          var _pageLengthY = (_pagey / 10) | 0;
          
        console.log(_pageLengthX);
       
          context.fillStyle = '#f60';
          context.fillRect(
              _pageLengthX * 10,
              _pageLengthY * 10,
              10,
              10);
              
      }
      */
      
      /*
      
     this._d3SvgContainer.on('click', () => {
      // Get coordinates of click relative to the canvas element
      var coordinates = d3.mouse(canvas.node());
      // Coordinates is a 2 element array: [x,y];
      var course = getCourseAtCoordinates(coordinates[0], coordinates[1]);
      if (course) {
        window.open(course.url, '_new');
      }
    });
    */

     this._DOMisUpdating = false;
     resolve(true);

    });
  }
  
  
  
  _drawCanvas(tableNo, cellWidth, cellHeight) {
      //draw the canvas
        this._context.clearRect(0, 0, this._element.offsetWidth, this._element.offsetHeight);
        
        var elements = this._custom.selectAll('custom.rect') // this is the same as the join variable, but used here to draw
        var context = this._context;
        
        
        elements.each(function(d,i) {

				// for each virtual/custom element...

				var node = d3.select(this);
				var style = node.attr('fillStyle');
				context.fillStyle = node.attr('fillStyle');
				context.fillRect(node.attr('x'), node.attr('y'), cellWidth, cellHeight);
				console.log('x:' + node.attr('x') + ",y:" + node.attr('y'));

			
        }); // loop through each element
  }
  


  _makeNewJob() {
    return {
      refreshLayout: false,
      size: this._size.slice(),
      words: this._words
    };
  }

  _makeJobPreservingLayout() {
    return {
      refreshLayout: false,
      size: this._size.slice(),
      words: this._completedJob.words.map(tag => {
        return {
          x: tag.x,
          y: tag.y,
          rotate: tag.rotate,
          size: tag.size,
          rawText: tag.rawText || tag.text,
          displayText: tag.displayText
        };
      })
    };
  }

  _invalidate(keepLayout) {

    if (!this._words) {
      console.log("data size is: 0");
      return;
    }
    else{
      console.log("data size is: " + this._words.length);
    }

    this._updateContainerSize();
    this._processPendingJob();
  }

  /**
   * Returns debug info. For debugging only.
   * @return {*}
   */
  getDebugInfo() {
    const debug = {};
    debug.positions = this._completedJob ? this._completedJob.words.map(tag => {
      return {
        displayText: tag.displayText,
        rawText: tag.rawText || tag.text,
        x: tag.x,
        y: tag.y,
        rotate: tag.rotate
      };
    }) : [];
    debug.size = {
      width: this._element.offsetWidth,
      height: this._element.offsetHeight
    };
    return debug;
  }

}

WaferMap.STATUS = { COMPLETE: 0, INCOMPLETE: 1 };


function getText(word) {
  return word.rawText;
}

function getCourseAtCoordinates(x, y) {
    for(let i = groupKeys.length - 1; i >= 0; i--) {
    let g = groupKeys[i];
    if (groupTop[g] < y) {
      // We know we're in this group, we know the size and spacing of the blocks
      // so figuring out which the row and column we're pointing at is easy.
      var row = Math.floor((y - groupTop[g] - groupSpacing) / (blockSize + spacing));
      var col = Math.floor(x / (blockSize + spacing));
      // Now get the index of the course
      var index = row * cols + col;
      // And finally the course itself
      var course = groups[g][index];
      return course || null;
    }
  }
  return null;
}

function getDisplayText(word) {
  return word.displayText;
}

function drawLabel( ctx, text, p1, p2, alignment, padding ){
  if (!alignment) alignment = 'center';
  if (!padding) padding = 0;

  var dx = p2.x - p1.x;
  var dy = p2.y - p1.y;   
  var p, pad;
  if (alignment=='center'){
    p = p1;
    pad = 1/2;
  } else {
    var left = alignment=='left';
    p = left ? p1 : p2;
    pad = padding / Math.sqrt(dx*dx+dy*dy) * (left ? 1 : -1);
  }

  ctx.save();
  ctx.textAlign = alignment;
  ctx.translate(p.x+dx*pad,p.y+dy*pad);
  ctx.rotate(Math.atan2(dy,dx));
  ctx.fillText(text,0,0);
  ctx.restore();
}

function drawText(context, text,  x, y, cellWidth, cellHeight) {
    
    context.font = "15px Arial";
    context.textAlign = "center";
    context.textBaseline = 'middle';
    context.fillStyle='#000000';
    context.fillText(text, x + cellWidth/2, y + cellHeight/2);
}

function positionWord(xTranslate, yTranslate, word) {

  if (isNaN(word.x) || isNaN(word.y) || isNaN(word.rotate)) {
    //move off-screen
    return `translate(${xTranslate * 3}, ${yTranslate * 3})rotate(0)`;
  }

  return `translate(${word.x + xTranslate}, ${word.y + yTranslate})rotate(${word.rotate})`;
}

function getValue(tag) {
  return tag.value;
}

function getSizeInPixels(tag) {
  return `${tag.size}px`;
}
/**
const colorScale = d3.scale.ordinal().range(seedColors);
function getFill(tag) {
  return colorScale(tag.text);
}
**/

function hashWithinRange(str, max) {
  str = JSON.stringify(str);
  let hash = 0;
  for (const ch of str) {
    hash = ((hash * 31) + ch.charCodeAt(0)) % max;
  }
  return Math.abs(hash) % max;
}


function num2e(num){
    if (num ===0) {
      return '0';
    }

    var p = Math.floor(Math.log(Math.abs(num))/Math.LN10);
    var n = num * Math.pow(10, -p);
    return (n.toFixed(3) + 'e' + p);
}

function formatNum(num) {
  return Math.round(num) === num ? num : num.toFixed(1);
}

function getColorValue(reverse) {
  if (!reverse) {
    return
  }
}

function getOrdinalColor(value, colorCategory){
  var index = colorCategory.find(function(a){
    return a[1] === value;
  });
  if (index == null) {
    index = colorCategory.length;
    colorCategory[index] = [index, value];
    return index;
  }
  else {
    return index[0];
  }


}

function revertX(x, maxX, defaultAxisOrientation, xAxisOrientationDefault, xIsAsc){
  if (xIsAsc) {
    if (defaultAxisOrientation || xAxisOrientationDefault) {
      return x;
    }
    else
      return maxX - x;
  }
  else {
    if (defaultAxisOrientation || xAxisOrientationDefault) {
      return maxX - x;
    }
    return x;
  }
}

function revertY(y, maxY, defaultAxisOrientation, yAxisOrientationDefault, yIsDes){
  if (yIsDes) {
    if (defaultAxisOrientation || yAxisOrientationDefault) {
      return y;
    }
    return maxY - y;
  }
  else {
    if (defaultAxisOrientation || yAxisOrientationDefault) {
      return maxY - y;
    }
    return y;
  }
}



export default WaferMap;
