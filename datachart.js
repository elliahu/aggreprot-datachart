import uPlot from './external/uPlot.esm.js';

// default threshold value is set to 0.5
let threshold = 0.5;
let labels = [];

/// Plugin highlights currently hovered-over column
function columnHighlightPlugin({ className, style = { backgroundColor: "rgba(253,231,76,0.2)" } } = {}) {
    let underEl, overEl, highlightEl, currIdx;

    function init(u) {
        underEl = u.under;
        overEl = u.over;

        highlightEl = document.createElement("div");

        className && highlightEl.classList.add(className);

        uPlot.assign(highlightEl.style, {
            pointerEvents: "none",
            display: "none",
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            ...style
        });

        underEl.appendChild(highlightEl);

        // show/hide highlight on enter/exit
        overEl.addEventListener("mouseenter", () => { highlightEl.style.display = null; });
        overEl.addEventListener("mouseleave", () => { highlightEl.style.display = "none"; });
    }

    function update(u) {
        if (currIdx !== u.cursor.idx) {
            currIdx = u.cursor.idx;

            let [iMin, iMax] = u.series[0].idxs;

            const dx = iMax - iMin;
            const width = (u.bbox.width / dx) / devicePixelRatio;
            const xVal = u.scales.x.distr == 2 ? currIdx : u.data[0][currIdx];
            const left = u.valToPos(xVal, "x") - width / 2;

            highlightEl.style.transform = "translateX(" + Math.round(left) + "px)";
            highlightEl.style.width = Math.round(width) + "px";
        }
    }

    return {
        opts: (u, opts) => {
            uPlot.assign(opts, {
                cursor: {
                    x: true,
                    y: true,
                }
            });
        },
        hooks: {
            init: init,
            setCursor: update,
        }
    };
}

/// renders draw time to the chart
function renderStatsPlugin({ textColor = 'red', font, debug = false } = {}) {
    font = font ?? `${Math.round(12 * devicePixelRatio)}px`;

    let startRenderTime;

    function setStartTime() {
        startRenderTime = Date.now();
    }

    function drawStats(u) {
        let { ctx } = u;
        let { left, top, width, height } = u.bbox;
        let displayText = "Time to Draw: " + (Date.now() - startRenderTime) + "ms";
        if (!debug) return;
        ctx.save();

        ctx.font = font;
        ctx.fillStyle = textColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(displayText, left + 10, top + 10);

        ctx.restore();
    }

    return {
        hooks: {
            drawClear: setStartTime,
            draw: drawStats,
        }
    };
}

/// Bar definitions for bar-chart rendering
const { linear, spline, stepped, bars } = uPlot.paths;
const _bars60_100 = bars({ size: [0.6, 100] });
const _bars80_100 = bars({ size: [0.8, 100] });
const _bars90_100 = bars({ size: [0.9, 100] });
const _bars100_100 = bars({ size: [1.0, 100] });

const datachart = {
    paths: {
        bars60_100: bars({ size: [0.6, 100] }),
        bars80_100: bars({ size: [0.8, 100] }),
        bars90_100: bars({ size: [0.9, 100] }),
        bars100_100: bars({ size: [1.0, 100] }),

        bars: bars,
        linear: linear,
        spline: spline,
        stepped: stepped,
    }
}

/// adds event listener of event ev on element el which call function
/// fn when fired
function on(ev, el, fn) {
    el.addEventListener(ev, fn);
}

/// removes event listener of event ev on element el which call function
/// fn when fired
function off(ev, el, fn) {
    el.removeEventListener(ev, fn);
}

/** 
 * Main entry point
 * Creates the charts based on the settings specified in the config
 * @param {*} data Data to be displayed
 * @param {*} config Configuration object
 * @param {*} element Element that will become parent of the charts
 * @returns Object containing functions that can be used to manipulate charts state
 *  onResidueSelectedFromStructure - accepts selected residue
 *  setThreshold - sets the threshold value
 */
function makeChart(data, config, element = document.body,) {
    /// set default labels to first protein sequence
    if(labels.length === 0) labels = data.dataframes[0].aa.data;
    /// pre-compute indexes if not set
    data.dataframes.forEach(dataframe => {
        console.log(dataframe);
        dataframe.indexes = Array.from({ length: dataframe.res.data.length }, (_, i) => i)     
    });

    /// config default values
    config.debug = config.debug ?? false;
    config.legendAsTooltip = config.legendAsTooltip ?? false;
    config.viewSize = config.viewSize ?? 15;
    config.leftOffset = config.leftOffset ?? 45;
    config.onAreaSelected = config.onAreaSelected ?? function (min, max) { };
    config.onResidueSelectedFromProfile = config.onResidueSelectedFromProfile ?? function (positions) { };
    config.labelBreakPoint = config.labelBreakPoint ?? 8;
    config.columnHighlight = config.columnHighlight ?? true;
    config.displayThresholdLineInRanger = config.displayThresholdLineInRanger ?? true;
    config.rangerTitle = config.rangerTitle ?? "Ranger";
    config.profilePlotTitle = config.profilePlotTitle ?? 'Aggregation profile';
    config.sequencePlotTitle = config.sequencePlotTitle ?? 'Sequence';
    config.grid = config.grid ?? {
        gridColor: '#dedede',
        width: 1,
        dash: []
    };
    config.ticks = config.ticks ?? {
        width: 1,
        size: 10,
        dash: []
    };
    config.axis = config.axis ?? {};
    config.axis.x = config.axis.x ?? {
        show: true,
        labelGap: 0,
        labelSize: 30,
        gap: 5
    };
    config.axis.y = config.axis.y ?? {
        show: true,
        labelGap: 0,
        labelSize: 30,
        gap: 5
    };
    config.pallette = config.pallette ?? {};
    config.pallette.threshold = config.pallette.threshold ?? {};
    config.pallette.threshold.stroke = config.pallette.threshold.stroke ?? "rgba(0,0,0,0.5)";
    config.pallette.threshold.dash = config.pallette.threshold.dash ?? [10, 10];
    config.pallette.threshold.spanGaps = config.pallette.threshold.spanGaps ?? true;
    config.pallette.columnHighlightColorHover = config.pallette.columnHighlightColorHover ?? 'rgba(0,0,0,0.04)';
    config.pallette.columnHighlightColorSelected = config.pallette.columnHighlightColorSelected ?? 'rgba(52,138,167,0.15)';

    /// id of the currently focused series
    let focusedSeriesIdx = null;

    const drawPoints = (u, seriesIdx, idx0, idx1) => {
        const size = 5 * devicePixelRatio;
        let { left, top, width, height } = u.bbox;
        height /= devicePixelRatio;
        let mHgt = (height / (u.series.length - 1)) * devicePixelRatio;

        function getRowPos(idy) {
            return idy * mHgt;
        }

        uPlot.orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo, rect, arc) => {
            let d = u.data[seriesIdx];

            u.ctx.fillStyle = series.fill();

            let deg360 = 2 * Math.PI;

            let p = new Path2D();

            for (let i = 0; i < d.length; i++) {
                let xVal = dataX;
                let yVal = dataY;

                if (xVal >= scaleX.min && xVal <= scaleX.max && yVal >= scaleY.min && yVal <= scaleY.max) {
                    let cx = 50;//valToPosX(xVal, scaleX, xDim, xOff);
                    let cy = 50; //valToPosY(yVal, scaleY, yDim, yOff);

                    u.ctx.fillStyle = 'red';
                    u.ctx.strokeStyle = 'red';
                    u.ctx.fillRect(cx, cy, 10, 10);

                    p.moveTo(cx + size / 2, cy);
                    arc(p, cx, cy, size / 2, 0, deg360);
                }
            }
            u.ctx.fill(p);
        });

        return null;
    };

    /// Plugin for panning the chart using the mouse wheel
    function wheelPanPlugin() {
        let xMin, xMax, yMin, yMax, xRange, yRange;

        return {
            hooks: {
                ready: u => {
                    xMin = u.scales.x.min;
                    xMax = u.scales.x.max;
                    yMin = u.scales.y.min;
                    yMax = u.scales.y.max;

                    xRange = xMax - xMin;
                    yRange = yMax - yMin;

                    let over = u.over;

                    // wheel drag pan
                    over.addEventListener("mousedown", e => {
                        if (e.button == 1) {
                            element.style.cursor = "move";
                            e.preventDefault();

                            let left0 = e.clientX;

                            let scXMin0 = u.scales.x.min;
                            let scXMax0 = u.scales.x.max;

                            let xUnitsPerPx = u.posToVal(1, 'x') - u.posToVal(0, 'x');

                            function onmove(e) {
                                e.preventDefault();

                                let left1 = e.clientX;

                                let dx = xUnitsPerPx * (left1 - left0);

                                const minMax = {
                                    min: scXMin0 - dx,
                                    max: scXMax0 - dx,
                                }

                                u.setScale('x', minMax);
                                sequencePlot.setScale('x', minMax);

                                uRanger.setSelect({
                                    left: uRanger.valToPos(u.scales.x.min, 'x', false),
                                    width: uRanger.valToPos(u.scales.x.max - u.scales.x.min, 'x', false)
                                }, false);
                            }

                            function onup(e) {
                                element.style.cursor = "auto"
                                document.removeEventListener("mousemove", onmove);
                                document.removeEventListener("mouseup", onup);
                            }

                            document.addEventListener("mousemove", onmove);
                            document.addEventListener("mouseup", onup);
                        }
                    });
                }
            }
        };
    }


    /// Plugin highlights selected indexes into the chart 
    function highlightSelectedIndexPlugin({ color = 'rgba(0,0,255,0.2)' } = {}) {
        let xLft, xWdt;

        function highlightIndexes(u) {
            let { ctx } = u;
            let { left, top, width, height } = u.bbox;

            xWdt = u.valToPos(1, 'x', true) - u.valToPos(0, 'x', true);

            for (let i = 0; i < selectedIndexes.length; i++) {
                
                let index = _indexOf(data.dataframes.filter(d => d.proteinID.data === selectedIndexes[i].protein)[0].res.data, selectedIndexes[i].idx);

                xLft = u.valToPos(index, 'x', true) - xWdt / 2;

                ctx.fillStyle = color;
                ctx.fillRect(xLft, top, xWdt, height);
            }
        }

        return {
            hooks: {
                draw: highlightIndexes,
            }
        }
    }

    let minSelectedIndex = (array) => {
        if (array.length == 0)
            return { idx: sequencePlot.scales.x.min };
        let min = array[0];
        for (let i = 0; i < array.length; i++) {
            if (array[i].idx < min.idx) min = array[i];
        }
        return min;
    }

    let maxSelectedIndex = (array) => {
        if (array.length == 0)
            return { idx: sequencePlot.scales.x.max };
        let max = array[0];
        for (let i = 0; i < array.length; i++) {
            if (array[i].idx > max.idx) max = array[i];
        }
        return max;
    }

    /// non-strict index of (== instead of === in .indexOf)
    function _indexOf(a,o) {    
        for (var i = 0; i < a.length; i++) {
            if(a[i] == o)
                return i;
        }
        return -1;
    }

    /// Function pans all charts to selected location
    /// spacer argument sets the left and right space before / after the selected range
    function panToSelectedIndexes(spacer = 5, size = config.viewSize,) {
        let m = minSelectedIndex(selectedIndexes.slice(-size));
        let mx =  maxSelectedIndex(selectedIndexes.slice(-size));
        let xMin = _indexOf(data.dataframes.filter(d => d.proteinID.data == m.protein)[0].res.data, m.idx);
        let xMax = _indexOf(data.dataframes.filter(d => d.proteinID.data == mx.protein)[0].res.data,mx.idx);
        let minMax = {}

        //if the selection is grouped (there is less the size between min and max) it will all remain in view
        if ((xMax - xMin) < size) {
            minMax = {
                min: (xMin - spacer < 0) ? 0 : xMin - spacer,
                max: (xMax + spacer > profilePolot.data[0].length - 1) ? profilePolot.data[0].length - 1 : xMax + spacer
            };
        }
        else { // if the selection is too wide, view will display latest index
            let tmp = _indexOf(data.dataframes.filter(d => d.proteinID.data == m.protein)[0].res.data, selectedIndexes[selectedIndexes.length - 1].idx);
            minMax = {
                min: tmp - spacer,
                max: tmp + size
            };
            if (minMax.min < 0) minMax.min = 0;
        }

        profilePolot.setScale('x', minMax);
        sequencePlot.setScale('x', minMax);
        uRanger.setSelect({
            left: uRanger.valToPos(minMax.min, 'x', false),
            width: uRanger.valToPos(minMax.max - minMax.min, 'x', false)
        }, false);
    }

    // Sync variables
    let cursorSync = uPlot.sync("cursor");
    let syncedUpDown = true;

    function upDownFilter(type) {
        return syncedUpDown || (type != "mouseup" && type != "mousedown");
    }

    const matchSyncKeys = (own, ext) => own == ext;

    // height limits
    let sequencePlotHeightLimit = 150;
    let rangerHeightLimit = 100;


    /// calculates size of the window
    /// allows height limitation
    function getWindowSize(heighLimit = 400) {
        return {
            width: element.offsetWidth,
            height: heighLimit // absolute height
        }
    }

    /// function updates threshold to a new value
    /// then uses the new threshold to rerender threshold line in the uplot1 chart
    /// and bars in the uplot2 chart
    function updateThreshold(value) {
        threshold = value;
        profilePolot.redraw();
        sequencePlot.redraw();

        if (config.displayThresholdLineInRanger) {
            uRanger.redraw();
        }
        return chartFunctions;
    }

    /// SELECTED INDEXES
    let selectedIndexes = [];

    // returns false if index is already selected, else returns true
    let addOrRemove = (index) => {
        for (let i = 0; i < selectedIndexes.length; i++) {
            if (index.protein == selectedIndexes[i].protein && index.idx == selectedIndexes[i].idx) {
                return false;
            }
        }
        return true;
    }

    let findIndex = (index) => {
        for (let i = 0; i < selectedIndexes.length; i++) {
            if (index.protein == selectedIndexes[i].protein && index.idx == selectedIndexes[i].idx) {
                return i;
            }
        }
        return -1;
    }

    // adds selected index
    function addSelectedIndex(index) {
        if (addOrRemove(index)) {
            selectedIndexes.push(index);
        }
        else {
            removeSelectedIndex(index);
        }
    }

    // removes selected index
    function removeSelectedIndex(index) {
        let where = findIndex(index);
        if (where >= 0) {
            selectedIndexes.splice(where, 1);
        }
        allRedraw();
    }

    // removes all selected indexes (clears selection)
    function removeAllSelectedIdxs(fire = false) {
        if (fire) {
            let p = [];
            selectedIndexes.forEach(i => p.push({
                position: i.idx,
                selected: false,
                protein: i.protein,
            }));
            config.onResidueSelectedFromProfile(p);
        }
        selectedIndexes = [];
        return chartFunctions;
    }

    /// RANGER
    /// ranger is used for navigation in the dataset
    /// allows selection of visible range
    let initXmin = 0; // initial value of start
    let minXMax = data.dataframes[0].indexes.length;
    if(data.dataframes.length > 0){
        for(let i = 0; i < data.dataframes.length; i++){
            minXMax = Math.min(minXMax,data.dataframes[i].indexes.length );
        }
    }
    let initXmax = Math.min(config.viewSize, minXMax)-1; // initial value of end

    let doc = document;

    function debounce(fn) {
        let raf;

        return (...args) => {
            if (raf)
                return;

            raf = requestAnimationFrame(() => {
                fn(...args);
                raf = null;
            });
        };
    }

    /// places div as a child if par and adds cls class to it
    function placeDiv(par, cls) {
        let el = doc.createElement("div");
        el.classList.add(cls);
        par.appendChild(el);
        return el;
    }

    let x0;
    let lft0;
    let wid0;

    const lftWid = { left: null, width: null };
    const minMax = { min: null, max: null };

    function update(newLft, newWid) {
        let newRgt = newLft + newWid;
        let maxRgt = uRanger.bbox.width / devicePixelRatio;

        if (newLft >= 0 && newRgt <= maxRgt) {
            select(newLft, newWid);
            zoom(newLft, newWid);
        }
    }

    function select(newLft, newWid) {
        lftWid.left = newLft;
        lftWid.width = newWid;
        uRanger.setSelect(lftWid, false);
    }

    function zoom(newLft, newWid) {
        minMax.min = uRanger.posToVal(newLft, 'x');
        minMax.max = uRanger.posToVal(newLft + newWid, 'x');
        profilePolot.setScale('x', minMax);
        sequencePlot.setScale('x', minMax);
    }

    function bindMove(e, onMove) {
        x0 = e.clientX;
        lft0 = uRanger.select.left;
        wid0 = uRanger.select.width;

        const _onMove = debounce(onMove);
        on("mousemove", doc, _onMove);

        const _onUp = e => {
            off("mouseup", doc, _onUp);
            off("mousemove", doc, _onMove);
            //viaGrip = false;
        };
        on("mouseup", doc, _onUp);

        e.stopPropagation();
    }

    // Y axis label options
    const yLabelOptions = 
    {
        label: "",
        labelSize: config.leftOffset
    };

    const rangerOpts = {
        title: config.rangerTitle,
        ...getWindowSize(rangerHeightLimit),
        cursor: {
            x: false,
            y: false,
            points: {
                show: false,
            },
            drag: {
                setScale: false,
                setSelect: true,
                x: true,
                y: false,
            },
        },
        legend: {
            show: false
        },
        scales: {
            x: {
                time: false,
            },
        },
        series: [
            {},
        ],
        hooks: {
            draw: [
                (u) => drawThresholdLine(u),
            ],
            ready: [
                uRanger => {
                    let left = Math.round(uRanger.valToPos(initXmin, 'x'));
                    let width = Math.round(uRanger.valToPos(initXmax, 'x')) - left;
                    let height = uRanger.bbox.height / devicePixelRatio;
                    uRanger.setSelect({ left, width, height }, false);

                    const sel = uRanger.root.querySelector(".u-select");

                    on("mousedown", sel, e => {
                        bindMove(e, e => update(lft0 + (e.clientX - x0), wid0));
                    });

                    on("mousedown", placeDiv(sel, "u-grip-l"), e => {
                        bindMove(e, e => update(lft0 + (e.clientX - x0), wid0 - (e.clientX - x0)));
                    });

                    on("mousedown", placeDiv(sel, "u-grip-r"), e => {
                        bindMove(e, e => update(lft0, wid0 + (e.clientX - x0)));
                    });
                }
            ],
            setSelect: [
                uRanger => {
                    zoom(uRanger.select.left, uRanger.select.width);
                }
            ],
        },
        axes: [
            {
                grid: {
                    show: true,
                    width: 2,
                    dash: [],
                    ...config.grid
                },
                ...config.axis.x,
            },
            {
                values: (u, vals, space) => "",
                ...yLabelOptions,
                ...config.axis.y
            },
        ],
        plugins: [
            highlightSelectedIndexPlugin({ color: config.pallette.columnHighlightColorSelected }),
            renderStatsPlugin({ textColor: '#333', debug: config.debug }),
        ],
    };

    // construct the data structure
    let _rangerDataFrame = [
        data.dataframes[0].indexes,
    ];
    for (let i = 0; i < data.dataframes.length; i++) {
        let q = 0;
        for (const [property ,value] of Object.entries(data.dataframes[i])){
            if('ranger' in data.dataframes[i][property]){
                _rangerDataFrame.push(data.dataframes[i][property].data);
                rangerOpts.series.push({
                    ...data.dataframes[i].agg.ranger
                });   
                q++; 
            }
        }
    }
    let uRanger = new uPlot(rangerOpts, _rangerDataFrame, element);

    let annotating = false;

    const cursorOpts = {
        lock: false,
        sync: {
            key: cursorSync.key,
            setSeries: true,
            match: [matchSyncKeys, matchSyncKeys],
            filters: {
                pub: upDownFilter,
            }
        },
        drag: {
            setScale: false,
            x: true,
            y: false
        },
        focus: {
            prox: 5,
        },
        dataIdx: (self, seriesIdx, hoveredIdx, cursorXVal) => {
            let xValues = self.data[0];
            let yValues = self.data[seriesIdx];

            if (yValues[hoveredIdx] == null) {
                let nonNullLft = null,
                    nonNullRgt = null,
                    i;

                i = hoveredIdx;
                while (nonNullLft == null && i-- > 0) {
                    if (yValues[i] != null)
                        nonNullLft = i;
                }

                i = hoveredIdx;
                while (nonNullRgt == null && i++ < yValues.length) {
                    if (yValues[i] != null)
                        nonNullRgt = i;
                }

                let rgtVal = nonNullRgt == null ? Infinity : xValues[nonNullRgt];
                let lftVal = nonNullLft == null ? -Infinity : xValues[nonNullLft];

                let lftDelta = cursorXVal - lftVal;
                let rgtDelta = rgtVal - cursorXVal;

                hoveredIdx = lftDelta <= rgtDelta ? nonNullLft : nonNullRgt;
            }

            return hoveredIdx;
        },
        bind: {
            dblclick: u => null
        }
    };

    /// hook function to draw threshold line directly to canvas
    function drawThresholdLine(u) {
        let ctx = u.ctx;

        ctx.save();

        let s = u.series[0];
        let xd = u.data[0];
        let yd = u.data[0];

        let [i0, i1] = s.idxs;

        let x0 = u.valToPos(xd[i0], 'x', true);
        let y0 = u.valToPos(threshold, 'y', true);
        let x1 = u.valToPos(xd[i1], 'x', true);
        let y1 = u.valToPos(threshold, 'y', true);

        const offset = (s.width % 2) / 2;

        ctx.translate(offset, offset);
        ctx.beginPath();
        ctx.strokeStyle = config.pallette.threshold.stroke;
        ctx.setLineDash(config.pallette.threshold.dash);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.translate(-offset, -offset);

        ctx.restore();
    }

    /// Function deselects current selection
    function removeSelection() {
        profilePolot.setSelect({ left: 0, width: 0 }, false);
        sequencePlot.setSelect({ left: 0, width: 0 }, false);
    }


    /// Function calculates how much space should be between x axis labels
    function getXGridSpacing(self, axisIdx, scaleMin, scaleMax) {
        let len = scaleMax - scaleMin;
        let diff = self.bbox.width / (len * window.devicePixelRatio);
        return diff;
    }

    /// Function returns single x axis label
    /// if the foundSpace is less then labelBreakPoint, it hides the labels so the don't overlap
    function getXGridValues(self, vals, axisIdx, foundSpace, foundIcr) {
        if (foundSpace > config.labelBreakPoint){
            return vals.map(v => labels[v]);
        }

            
        else
            return "";
    }

    /// Function return single Y axis label
    function getYGridValues(u, vals, space) {
        return vals.map(v => +v.toFixed(1) + "");
    }

    function getYGridValuesLabeld(u, vals, space) {
        return 'a'
    }

    // redraws all charts
    function allRedraw() {
        uRanger.redraw();
        profilePolot.redraw();
        sequencePlot.redraw();
    }

    function setApr(protein, apr, idx){
        console.log('qqq');
    }

    /// Aggregation chart

    const gridOpts = {
        show: true,
        ...config.grid
    };

    const tickOpts = {
        show: true,
        stroke: config.grid.gridColor,
        ...config.ticks
    };

    let over;
    let click = false;
    let clientX;
    let clientY;
    let focusedIdxStart = null;
    let shiftKey = true;
    let currentIdx = null;

    // converts the legend into a simple tooltip
    function legendAsTooltipPlugin({ className, style = { backgroundColor: '#f3f2ee', color: "#333" } } = {}) {
        let legendEl;

        function init(u, opts) {
            legendEl = u.root.querySelector(".u-legend");

            legendEl.classList.remove("u-inline");
            className && legendEl.classList.add(className);

            uPlot.assign(legendEl.style, {
                textAlign: "left",
                pointerEvents: "none",
                display: "none",
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: 100,
                boxShadow: "2px 2px 10px rgba(0,0,0,0.5)",
                ...style
            });

            const overEl = u.over;
            overEl.style.overflow = "visible";

            // move legend into plot bounds
            overEl.appendChild(legendEl);

            // show/hide tooltip on enter/exit
            overEl.addEventListener("mouseenter", () => { legendEl.style.display = null; });
            overEl.addEventListener("mouseleave", () => { legendEl.style.display = "none"; });

            // let tooltip exit plot
            overEl.style.overflow = "visible";
        }

        function update(u) {
            const { left, top } = u.cursor;
            legendEl.style.transform = "translate(" + left + "px, " + top + "px)";
        }

        if (config.legendAsTooltip) {
            return {

                hooks: {
                    init: init,
                    setCursor: update,
                }
            };
        }
        return { hooks: {} }
    }

    function clickToSelect(u) {
        over = u.over;

        over.addEventListener("mousedown", e => {
            click = false;
            clientX = e.clientX;
            clientY = e.clientY;
            focusedIdxStart = focusedSeriesIdx;
            shiftKey = e.shiftKey;
        });

        over.addEventListener("mouseup", e => {
            // clicked in-place
            if (e.clientX == clientX && e.clientY == clientY) {
                click = true;

                if (!e.shiftKey) {
                    removeAllSelectedIdxs(true);
                    shiftKey = false;
                }
                
                let proteinID = u.series[(focusedSeriesIdx == null) ? 1 : focusedSeriesIdx].protein;
                let res = data.dataframes.filter(d => d.proteinID.data === proteinID)[0].res.data[currentIdx]; // 

                if(res === null) return;
                
                let position = {
                    position: res,
                    selected: addOrRemove(res),
                    protein: proteinID
                }
                addSelectedIndex({
                    idx: res,
                    protein: proteinID
                });
                config.onResidueSelectedFromProfile([position]);
                allRedraw();
            }
        });
    }

    const opts = {
        title: config.profilePlotTitle,
        ...getWindowSize(),
        focus: {
            alpha: 0.3,
        },
        scales: {
            x: {
                time: false,
                min: initXmin,
                max: initXmax,
            },
            y: {
                range: [0, 1],
                time:false
            }
        },
        cursor: cursorOpts,
        select: {
            over: false,
        },
        series: [
            {
                label: 'Residue',
                protein: data.dataframes[0].proteinID.data,
                value: (u, v) => {
                    if (v === null) return "NA;";
                    let dspl = '';
                    for (let i = 0; i < data.dataframes.length; i++) {
                        if (data.dataframes[i].aa.data[v] === null) {
                            dspl += 'NA; ';
                        }
                        else {
                            dspl += '' + data.dataframes[i].proteinID.data + ' - ' + data.dataframes[i].aa.data[v] + ' (' + data.dataframes[i].res.data[v] + '); ';
                        }

                    }
                    return dspl;
                },
            },
        ],
        bands: [
            {
                series: [3, 1]
            }
        ],
        axes: [
            {
                values: getXGridValues,
                space: getXGridSpacing,
                grid: gridOpts,
                ...config.axis.x,
            },
            {
                values: getYGridValues,
                grid: gridOpts,
                ticks: tickOpts,
                ...yLabelOptions,
                label: "Aggregation propensity",
                ...config.axis.y
            },
        ],
        plugins: [
            renderStatsPlugin({ textColor: '#333', debug: config.debug }),
            (config.columnHighlight) ? columnHighlightPlugin({ style: { backgroundColor: config.pallette.columnHighlightColorHover } }) : () => { },
            highlightSelectedIndexPlugin({ color: config.pallette.columnHighlightColorSelected }),
            wheelPanPlugin(),
            legendAsTooltipPlugin(),
        ],
        hooks: {
            draw: [
                (u) => drawThresholdLine(u),
            ],
            ready: [
                (u) => {
                    clickToSelect(u);
                }
            ],
            setSelect: [
                (u) => {
                    let _lIdx;
                    let _rIdx;



                    if (click || (u.select.left == 0 && u.select.width == 0)) {
                        return;
                    }
                    else {
                        _lIdx = u.posToIdx(u.select.left);
                        _rIdx = u.posToIdx(u.select.left + u.select.width);
                    }

                    config.onAreaSelected(_lIdx, _rIdx);

                    if (!shiftKey) {
                        removeAllSelectedIdxs(true);
                        shiftKey = false;
                    }

                    let positions = [];
                    // register indexes in selected area
                    for (let i = _lIdx; i <= _rIdx; i++) {
                        // order of the following matters
                        let proteinID = u.series[(focusedIdxStart == null) ? 0 : focusedIdxStart].protein;
                        let res = data.dataframes.filter(d => d.proteinID.data === proteinID)[0].res.data[i];

                        if(res === null) continue;

                        positions.push({
                            position: res,
                            selected: addOrRemove(res),
                            protein: proteinID,
                        });
                        addSelectedIndex({
                            idx: res,
                            protein: proteinID
                        });
                    }

                    config.onResidueSelectedFromProfile(positions);

                    allRedraw();
                    // remove selection
                    removeSelection();
                }
            ],
            setCursor: [
                (u) => {
                    let c = u.cursor;
                    currentIdx = c.idx;
                }
            ],
            setSeries: [
                (u, sidx) => {
                    focusedSeriesIdx = sidx;
                }
            ]
        },
    };



    let _topDataFrameData = [
        data.dataframes[0].indexes,
    ];

    for (let i = 0; i < data.dataframes.length; i++) {
        let q = 0;
        for (const [property ,value] of Object.entries(data.dataframes[i])){
            if('profile' in data.dataframes[i][property]){
                _topDataFrameData.push(data.dataframes[i][property].data);
                opts.series.push({
                    protein: data.dataframes[i].proteinID.data,
                    value: (u, v) => v == null ? "-" : parseFloat(v).toFixed(2) + "",
                    ...data.dataframes[i][property].profile
                });   
                q++; 
            }
        }
    }

    let profilePolot = new uPlot(opts, _topDataFrameData, element);
    console.log(profilePolot);

    function seriesPointsPlugin({ spikes = 4, outerRadius = 8, innerRadius = 4 } = {}) {
        outerRadius *= devicePixelRatio;
        innerRadius *= devicePixelRatio;

        function drawStar(ctx, cx, cy) {
            let rot = Math.PI / 2 * 3;
            let x = cx;
            let y = cy;
            let step = Math.PI / spikes;

            ctx.beginPath();
            ctx.moveTo(cx, cy - outerRadius);

            for (let i = 0; i < spikes; i++) {
                x = cx + Math.cos(rot) * outerRadius;
                y = cy + Math.sin(rot) * outerRadius;
                ctx.lineTo(x, y);
                rot += step;

                x = cx + Math.cos(rot) * innerRadius;
                y = cy + Math.sin(rot) * innerRadius;
                ctx.lineTo(x, y);
                rot += step;
            }

            ctx.lineTo(cx, cy - outerRadius);
            ctx.closePath();
        }

        function drawPoints(u, i, i0, i1) {
            let { ctx } = u;
            let { _stroke, scale } = u.series[i];
            let { left, top, width, height } = u.bbox;
            height /= devicePixelRatio;

            let mHgt = (height / (u.series.length - 1)) * devicePixelRatio;
            // TODO calc the maximal width - width of one column
            let mWidth = Math.abs(u.valToPos(0, 'x', false) - u.valToPos(1, 'x', false));

            function getRowPos(idy) {
                return idy * mHgt;
            }

            ctx.save();

            ctx.fillStyle = _stroke;

            let j = i0;

            while (j <= i1) {
                // call the display function of series and if the series should be drawn, draw it
                if (u.series[i].display(threshold, u.series[i], i, j, u.data)) {
                    let cx = Math.round(u.valToPos(u.data[0][j], 'x', true));
                    let cy = getRowPos(i);
                    if (u.series[i].draw != null) {
                        u.series[i].draw(ctx, cx, cy, mHgt, mWidth)
                    }
                    else {
                        drawStar(ctx, cx, cy);
                    }
                    ctx.fill();
                }
                j++;
            };

            ctx.restore();
        }

        return {
            opts: (u, opts) => {
                opts.series.forEach((s, i) => {
                    if (i > 0) {
                        uPlot.assign(s, {
                            points: {
                                show: drawPoints,
                            }
                        });
                    }
                });
            }
        };
    }

    const sequenceOpts = {
        title: config.sequencePlotTitle,
        ...getWindowSize(sequencePlotHeightLimit),
        cursor: cursorOpts,
        focus: {
            alpha: 0.3,
        },
        select: {
            over: false,
        },
        legend: {
            show: false
        },
        scales: {
            x: {
                time: false,
                min: initXmin,
                max: initXmax,
            },
        },
        series: [
            {},

        ],
        axes: [
            {
                values: getXGridValues,
                space: getXGridSpacing,
                ...config.axis.x,
                grid: gridOpts,
            },
            {
                values: (u, vals, space) => "",
                ...config.axis.y,
                ...yLabelOptions,
            },
        ],
        hooks: {
            ready: [
                (u) => {
                    clickToSelect(u);
                }
            ],
            drawSeries: [
                (u, idx) => {
                    let { ctx } = u;
                    let { left, top, width, height } = u.bbox;
                    height /= devicePixelRatio;

                    let mHgt = (height / (u.series.length - 1)) * devicePixelRatio;

                    function getRowPos(idy) {
                        return idy * mHgt;
                    }

                    let cx = left;
                    let cy = getRowPos(idx);

                    ctx.font = `${Math.round(13 * devicePixelRatio)}px`;
                    ctx.fillStyle = 'black';
                    ctx.fillText(u.series[idx].label, cx - 25, cy);
                },

                (u, sidx) => {
                    //focusedSeriesIdx = sidx;
                }
            ],
            setCursor: [
                (u) => {
                    let c = u.cursor;
                    currentIdx = c.idx;
                }
            ],
        },
        plugins: [
            highlightSelectedIndexPlugin({ color: config.pallette.columnHighlightColorSelected }),
            seriesPointsPlugin(),
            (config.columnHighlight) ? columnHighlightPlugin({ style: { backgroundColor: config.pallette.columnHighlightColorHover } }) : () => { },
            renderStatsPlugin({ textColor: '#333', debug: config.debug }),
        ]
    };

    sequenceOpts.cursor.dataIdx = () => { };

    let sequenceData = [
        data.dataframes[0].indexes
    ];
    for (let i = 0; i < data.dataframes.length; i++) {

        let q = 0;
        for (const [property ,value] of Object.entries(data.dataframes[i])){
            if('sequence' in data.dataframes[i][property]){
                sequenceData.push(data.dataframes[i][property].data);
                sequenceOpts.series.push({
                    protein: data.dataframes[i].proteinID.data,
                    value: (u, v) => v == null ? "-" : v + "",
                    display: function(){},
                    paths: function(){},
                    ...data.dataframes[i][property].sequence
                });   
                q++; 
            }
        }
    }
    // TODO use priority ordering her to move APR values to the top rows
    let sequencePlot = new uPlot(sequenceOpts, sequenceData, element);

    window.addEventListener("resize", e => {
        profilePolot.setSize(getWindowSize());
        sequencePlot.setSize(getWindowSize(sequencePlotHeightLimit));
        uRanger.setSize(getWindowSize(rangerHeightLimit));
    });

    // returns functions to update the chart
    let chartFunctions = {
        onResidueSelectedFromStructure: (position, selected, protein) => {
            // behavior:
            // 1. user selects residue using structure viewer
            // 2. right after the residue is selected, this function onResidueSelectedFromStructure is called
            // 3. this function will tell chart to show the residue as selected
            console.log(`residue ${position} in ${protein} protein was selected using structure viewer, chart will be updated`);

            // get the position and add/remove it from array
            selected ? addSelectedIndex({ idx: position, protein: protein }) : removeSelectedIndex({ idx: position, protein: protein });
            panToSelectedIndexes();
            uRanger.redraw();
            return chartFunctions;
        },
        setThresholdValue: updateThreshold,
        toggleVisibility: (protein) => {
            profilePolot.series.forEach((s, i) => {
                if (s.protein == protein && s.scale == 'y') {
                    profilePolot.setSeries(i, { show: !profilePolot.series[i].show });
                }
            });
            sequencePlot.series.forEach((s, i) => {
                if (s.protein == protein && s.scale == 'y') {
                    sequencePlot.setSeries(i, { show: !sequencePlot.series[i].show });
                }
            });
            return chartFunctions;
        },
        displaySequenceAsXLabels: (protein) => {
            let frame = data.dataframes.filter((f) => f.proteinID.data === protein);
            if (frame.length > 0) {
                labels = frame[0].aa.data;
            }
            // frame refresh
            profilePolot.setSize(getWindowSize());
            sequencePlot.setSize(getWindowSize(sequencePlotHeightLimit));
            return chartFunctions;
        },
        clearSelection: removeAllSelectedIdxs,
        setYRange: (min, max) => {
            profilePolot.setScale('y', { min: min, max: max });
            return chartFunctions;
        },
        setView: (min, max) => {
            uRanger.setSelect({
                left: uRanger.valToPos(min, 'x', false),
                width: uRanger.valToPos(max - min, 'x', false)
            }, false);
            // initial value has to be set as well as this might called before the ready hook is initiated
            initXmin = min; 
            initXmax = max;
            profilePolot.setScale('x', {min: min, max:max});
            sequencePlot.setScale('x', {min: min, max:max});
            return chartFunctions;
        },
        setAprs: (protein, aprs) => aprs.forEach((apr, idx) => setApr(protein, apr, idx)),
        setApr: (protein, val, idx) => setApr(protein, val, idx),
        getAvailableColumnWidth: (col) => 100,
    };
    return chartFunctions;
}

/**
 * @deprecated
 * @param {*} path 
 * @returns 
 */
async function fetchData(path) {
    // fetch the data
    let data = await fetch(path);
    if (!data.ok) {
        throw `Could not fetch ${path} file!`;
    }
    // read the data
    let text = await data.text();
    return parseJSON(text);
}

/**
 * @deprecated
 * @param {*} text 
 * @returns 
 */
function parseJSON(text) {
    let data = JSON.parse(text,
        (key, value) => {
            if (value === 'NA' || value === null || value == 'null' || value == 'undefined')
                return null;
            return value;
        });

    let _ret = {
        dataframes: []
    };

    if (typeof (data) != 'object' || Array.isArray(data)) {
        throw 'Provided json is invalid or has the wrong format!';
    }

    for (const [protein, value] of Object.entries(data)) {
        // each dataset can hold multiple proteins
        // for each protein:
        let _x = value.Res;
        let _labels = value.Aa;

        // labels are set based on the first protein
        // this can be changed at runtime by calling displaySequenceAsXLabels on the instance created with makeChart
        if (labels.length == 0) {
            labels = _labels;
        }

        let _agg = value.AggreProt;
        let _asa = value.ASA;
        let _tm = value.TM;

        _ret.dataframes.push({
            proteinID: protein,
            indexes: {
                data: Array.from({ length: value.Aa.length }, (_, i) => i)
            },
            res: {
                data: _x
            },
            aa: {
                data: _labels
            },
            agg: {
                data: _agg
            },
            asa: {
                data: _asa
            },
            tm: {
                data: _tm
            }
        });
    }

    return _ret;
}
// exports
export { fetchData, makeChart, datachart };
