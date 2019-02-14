import d3 from 'd3';
//import d3Tip from "d3-tip"
//import { seedColors } from 'ui/vis/components/color/seed_colors';
import { EventEmitter } from 'events';
import BinColors from './BinColors';

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
    this._d3SvgContainer = d3.select(this._element).append('svg');
    this._svgGroup = this._d3SvgContainer.append('g')
        .attr("transform", "translate(" + this._marginLeft + "," + this._marginTop + ")");
    this._size = [1, 1];

    this._tooltip = d3.select(this._element).append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);



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
    this._svgGroup.attr('width', this._element.offsetWidth);
    this._svgGroup.attr('height', this._element.offsetHeight);
  }

  _isJobRunning() {
    return (this._setTimeoutId || this._DOMisUpdating);
  }

  async _processPendingJob() {

    if (!this._pendingJob) {
      return;
    }

    if (this._isJobRunning()) {
      return;
    }


    this._completedJob = null;
    const job = await this._pickPendingJob();
    if (job.words.length) {
      await this._updateDOM(job);
    } else {
      this._emptyDOM(job);
    }

    if (this._pendingJob) {
      this._processPendingJob();//pick up next job
    } else {
      this._completedJob = job;
      this.emit('renderComplete');
    }

  }

  async _pickPendingJob() {
    return await new Promise((resolve) => {
      this._setTimeoutId = setTimeout(async () => {
        const job = this._pendingJob;
        this._pendingJob = null;
        this._setTimeoutId = null;
        resolve(job);
      }, 0);
    });
  }


  _emptyDOM() {
    this._svgGroup.selectAll('*').remove();
    this._cloudWidth = 0;
    this._cloudHeight = 0;
    this._allInViewBox = true;
    this._DOMisUpdating = false;
  }

  async _updateDOM(job) {

    const canSkipDomUpdate = this._pendingJob || this._setTimeoutId;
    if (canSkipDomUpdate) {
      this._DOMisUpdating = false;
      return;
    }

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

      var colorScale = d3.scale.linear()
        .domain(d3.range(0, 1, 1.0 / (this._colorRange.length)))
        .range(this._colorRange);
      var colorDomain = d3.scale.linear().domain([this._minZ,this._maxZ]).range([0,1]);

      var tooltip = this._tooltip;
      var defaultAxisOrientation = this._defaultAxisOrientation;

      let tableNo = 0;
      let metricTitle = this._series ? this._words[tableNo].tables["0"].columns[2].title : this._words[tableNo].columns[2].title;
      const xTitle = this._series ? this._words[tableNo].tables["0"].columns[0].title : this._words[tableNo].columns[0].title;
      const yTitle = this._series ? this._words[tableNo].tables["0"].columns[1].title : this._words[tableNo].columns[1].title;
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
        if (this._words[0].aggConfig._aggs[1].params.orderBy == '_key') {
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
	if (cellHeight < 10) {
	  if (this._colorBucket !== 2) {
			  this._colorBucket = 4;
		}
  }

  var isOrdinal = false;
  var isCustomziedBinning = false;

  var colorScale20 = d3.scale.category20();
  var colorScale20b = d3.scale.category20b();
  var colorScale20c = d3.scale.category20c();
  var isBinning = metricTitle.indexOf('.num') === -1 ? false : true;

  if (this._colorScale === 'ordinal' && isBinning) {
    colorScale = colorScale20;
    isOrdinal = true;
  }
  else if (this._colorScale === 'customzied binning' && isBinning) {
    isCustomziedBinning = true;
  }
  var colorCategory = [];

  while (tableNo !== tableCnt) {
    let rowNo = Math.floor(tableNo / this._columnCnt);
    let ltx = (tableNo % this._columnCnt) / this._columnCnt * width;
    let lty = rowNo * (height / this._rowCnt);

    // plot the last row x-axis only

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
              i =  revertX(i, maxX, defaultAxisOrientation, xAxisOrientationDefault);
              return (i + 0.5) * cellWidth + ltx;
            })
            .attr("y", function (d, i) {
              return lty + (maxY + 1 + spaceCellCnt / 2) * cellHeight;
           });
         // xAxis title
         /*
         var xAxisTitle = this._svgGroup.append("text")
             .text(xTitle.split(":")[0] + ": Descending")
             .attr("x",
               ltx + maxX * cellWidth / 2
             )
             .attr("y",
               lty + chartHeight - this._marginNeighbor
             )
             .attr("dy", "1em")
             .attr("font-size", "0.8em")
             .style("text-anchor", "middle");
          */

          // sereis title if necessary
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
              i = revertY(i, maxY, defaultAxisOrientation, yAxisOrientationDefault);
              return (i + 0.5) * cellHeight + lty;
            });
            // yAxis title
         /**
         var yAxisTitle = this._svgGroup.append("text")
             .text(yTitle.split(":")[0] + ": Ascending")
             .attr("font-size", "0.8em")
             .attr("transform", "rotate(-90)")
             .attr("x", 0 - lty - cellHeight * maxY / 2)
             .attr("y", this._rowCnt > 1 ? -25 : -35)
             //.attr("dy", ".5em")
             .style("text-anchor", "middle");
         */
      }

    var rectangles = this._svgGroup.selectAll("rect-" + tableNo)
          .data(this._series ? this._words[tableNo].tables["0"].rows : this._words[tableNo].rows)
        rectangles.exit().remove();
        rectangles
          .enter()
          .append("g");

        var map = rectangles.append("rect")
           .attr("x", function (d) {
             var x = revertX(d[0], maxX, defaultAxisOrientation, xAxisOrientationDefault);
             return (x * cellWidth + ltx);
           })
           .attr("y", function(d) {
            var y = revertY(d[1], maxY, defaultAxisOrientation, yAxisOrientationDefault);
            return (y * cellHeight + lty);
           })

          .attr("width", cellWidth)
          .attr("height", cellHeight)
          .attr('fill', function(d) {
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
              return BinColors.getColor(d[2]);
            }
            else {
              return isOrdinal ? colorScale(colorNo) : colorScale(reverseColor ? 1 -  colorDomain(d[2]) : colorDomain(d[2]));
            }
          });


          if (this._showLabel) {
            rectangles.append('text')
            .text(function (d) {
              return d[2];
            })
            .style('display', function (d) {
              const textLength = this.getBBox().width;
              const textHeight = this.getBBox().height;
              const textTooLong = textLength > cellWidth;
              const textTooWide = textHeight > cellHeight;
              return textTooLong || textTooWide ? 'none' : 'initial';
            })
            .style('dominant-baseline', 'central')
            .style('text-anchor', 'middle')
            .style('fill', '#000000')
            .attr("x", function (d) {
               var x = revertX(d[0], maxX, defaultAxisOrientation, xAxisOrientationDefault);
               return (x + 0.5) * cellWidth + ltx;
            })
            .attr("y", function(d) {
              var y = revertY(d[1], maxY, defaultAxisOrientation, yAxisOrientationDefault);
              return (y + 0.5) * cellHeight + lty;
            });
          }

          let seriesTitle = "";
          // add for tooltip
          if (isSeries) {
            seriesTitle = this._words[tableNo].title.split(":")[1];
          }
          let _xTitle = xTitle.split(":")[0];
          let _yTitle = yTitle.split(":")[0];

          let seriesTitleLength = seriesTitle.length;
          let maxTitleLength = seriesTitleLength > xTitleLength ?
            (seriesTitleLength > yTitleLength ? seriesTitleLength : yTitleLength)
            : (xTitleLength > yTitleLength ? xTitleLength : yTitleLength);
          maxTitleLength = maxTitleLength > metricTitleLength ? maxTitleLength : metricTitleLength;
          while (metricTitleLength ++ < (maxTitleLength)) {
            metricTitle += '&nbsp;';
          }
          while (xTitleLength ++ < maxTitleLength) {
            _xTitle += '&nbsp;';
          }
          while (yTitleLength ++ < maxTitleLength) {
            _yTitle += '&nbsp;';
          }
          while (seriesTitleLength ++ < maxTitleLength) {
            seriesTitle += '&nbsp;';
          }
          seriesTitle = isSeries ? ("<br/>"  + seriesTitle + '&nbsp;' + this._words[tableNo].title.split(":")[0]) : '';
          const enableToolTip = this._addTooltip;
          map.on("mouseover", function(d) {
             d3.select(this).classed("cell-hover",true);
                tooltip.html(metricTitle + '&nbsp;' + d[2]
                  + "<br/>"  + _xTitle + '&nbsp;' + d[0]
                  + "<br/>"  + _yTitle + '&nbsp;' + d[1]
                  + seriesTitle
                 )
                 .style("left", (d3.mouse(this)[0] + (d[0] < maxX / 2 ? -100 : 60)) + "px")
                 .style("top", (d3.mouse(this)[1] + (d[1] < maxY / 2 ? -100 : 60)) + "px")

                 .style("opacity", enableToolTip ? 1 : 0)
                ;
           })
           .on("mouseout", function(d) {
             d3.select(this).classed("cell-hover",false);
             tooltip.style("opacity", 0);
         });
        tableNo++;
      }
      // sort the color lable if needed
      if (isOrdinal || isCustomziedBinning) {
        colorCategory.sort(function(a, b){
          return a[1] - b[1];
        });
      }

      // add the color legend
      var colors = [];
      const legendWidth = 20;
      var colorBucket = (isOrdinal || isCustomziedBinning) ? colorCategory.length - 1 : this._colorBucket;
      const dis = (this._maxZ - this._minZ) / colorBucket;
      let colorNo = 0;
      const legendHeight = height / ((colorBucket + 4));
      while (colorNo != colorBucket + 1) {
       // this._colors[colorNo] = num2e(dis * colorNo + this._minZ);
        if (isOrdinal || isCustomziedBinning) {

        }
        else {
          const colorValue = dis * colorNo + this._minZ;
          colors.push(num2e(colorNo === colorBucket ? this._maxZ : colorValue));
        }
        colorNo++;
      }


      var legendLabels = this._svgGroup.selectAll("legendLabel").data(isOrdinal || isCustomziedBinning ? colorCategory : colors);
      legendLabels.exit().remove();
      legendLabels.enter().append("text")
        .text(function (d) {
          if (isOrdinal || isCustomziedBinning) {
            return d[1];
          }
        return d;
        })
        .attr("class", "series-title")
        .attr("x", this._element.offsetWidth - this._marginLeft - legendWidth - 12)
        .attr("y", function (d, i) { return (i + 1.5) * legendHeight; })
        .attr("dy", "0.5em")
        .style("text-anchor", "end");

      var legendTitle = this._svgGroup.append("text")
        .text(this._series ? this._words[0].tables["0"].columns[2].title : this._words[0].columns[2].title)
        .attr("x", this._element.offsetWidth - this._marginLeft - 10)
        .attr("y", legendHeight - 15)
        .style("text-anchor", "end");


      var legendRect = this._svgGroup.selectAll("legendRect").data(isOrdinal || isCustomziedBinning ? colorCategory : colors);
      legendRect.exit().remove();

      legendRect
        .enter()
        .append("rect")
        .attr("x", this._element.offsetWidth - this._marginLeft - legendWidth - 10)
        .attr("y", function (d, i) { return (i +1) * legendHeight; })
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", function(d){
          if (isOrdinal) {
            var i = d[0];
            if (i <= 19) {
              colorScale = colorScale20;
            }
            else if (i <= 39) {
              colorScale = colorScale20b;
              i -= 20;
            }
            else {
              colorScale = colorScale20c;
              i -= 40;
            }
          }
          else if (isCustomziedBinning) {
            return BinColors.getColor(d[1]);
          }

          return isOrdinal ?  colorScale(i) : colorScale(reverseColor ? 1- colorDomain(d) : colorDomain(d));
        });
     this._DOMisUpdating = false;
     resolve(true);

    });
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
      return;
    }

    this._updateContainerSize();

    const canReuseLayout = false;
    this._pendingJob = (canReuseLayout) ? this._makeJobPreservingLayout() : this._makeNewJob();
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

function getDisplayText(word) {
  return word.displayText;
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

function revertX(x, maxX, defaultAxisOrientation, xAxisOrientationDefault){
  if (defaultAxisOrientation || xAxisOrientationDefault) {
    return x;
  }
  return maxX - x;
}

function revertY(y, maxY, defaultAxisOrientation, yAxisOrientationDefault){
  if (defaultAxisOrientation || yAxisOrientationDefault) {
    return y;
  }
  return maxY - y;
}



export default WaferMap;
