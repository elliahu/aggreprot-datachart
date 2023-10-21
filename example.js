import {makeChart} from './datachart.js';

/**
 * This is an example of the 2D module usage in JS apps
 */

// name of the json file that will be fetched
let json = 'HLDsData.json';

// create an optional config to configure chart
let config = {
    debug: true,
    legendAsTooltip: true,
    onAreaSelected: (min, max) => console.log(`area selected [${min}, ${max}]`), // area selected callback
    onResidueSelectedFromProfile: (positions) => {
        positions.forEach(p => console.log(p));
    },
}

const drawRect = (ctx, cx, cy, maxHeight, maxWidth) => {
    ctx.beginPath();
    ctx.rect(cx - maxWidth / 2, cy - maxHeight / 2, maxWidth * devicePixelRatio, maxHeight * devicePixelRatio);
    ctx.fill();
    ctx.stroke();
};

// fetch the file then use the data from the result 

let chartFunctions = null;
(async function() {
    const response = await fetch(json);
    const data = await response.json();
    const makechartData = {
        dataframes: data.map(p => ({
            proteinID: {
                data: p.name
            },
            res: {
                data: p.positions
            },
            aa: {
                data: p.aminoAcids
            },
            apr: {
                data: p.apr,
                sequence: {
                    stroke: 'black',
                    fill: 'black',
                    label: "APR",
                    display: (threshold, series, seriesIdx, dataIdx, data) => {
                        return data[seriesIdx][dataIdx] == 1;
                    },
                    draw: drawRect
                },
                exclusiveOrder: 0
            },
            agg: {
                data: p.aggreprot,
                ranger:{
                    stroke: 'red',
                    fill: 'rgba(255, 155, 84, 0.6)',
                    fillTo: 0,
                },
                profile: {
                    stroke: 'red',
                    fill: 'rgba(255, 155, 84, 0.6)',
                    fillTo: 0,
                    width: 3,
                    label: 'Aggregation',
                    points: {
                        size: 10
                    }
                },
                sequence: {
                    stroke: 'red',
                    fill: 'rgba(255, 155, 84, 0.6)',
                    label: "Aggregation", 
                    display: (threshold, series, seriesIdx, dataIdx, data) => {
                        return data[seriesIdx][dataIdx] > threshold;
                    },
                    draw: drawRect,
                }
            },
            asa: 
            {
                data: p.sasa,
                profile: {
                    stroke: 'red',
                    fill: null,
                    dash: [10, 5],
                    label: 'ASA',
                    points: {
                        size: 5
                    }
                },
                sequence: {
                    stroke: 'green',
                    fill: 'rgba(0, 255, 0, 0.2)',
                    label: "Exposure",
                    display: (threshold, series, seriesIdx, dataIdx, data) => {
                        return data[seriesIdx][dataIdx] > threshold;
                    },
                    draw: drawRect
                }
            },
            tm: {
                data: p.transmembrane,
                profile: {
                    stroke: 'red',
                    fill: null,
                    label: 'TM',
                    points: {
                        size: 5
                    }
                }
            },
        })),
    };
    chartFunctions = makeChart(makechartData, config, document.body)
        .setView(0, 15)
        .setYRange(0, 1);
})();
/*
let chartFunctions = makeChart(
    {
      dataframes: [
        // Protein 1
        // proteinID, res, aa are required
        {
            proteinID: {
                data: 'cdk4'
            },
            res: {
                data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            }, 
            aa: {
                data: ["J", "I", null, "G", "F", "E", "D", "C", "B", "A"]
            }, 
            apr: {
                data: [0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
                sequence: {
                    stroke: 'black',
                    fill: 'red',
                    label: "APR",
                    display: (threshold, series, seriesIdx, dataIdx, data) => {
                        return data[seriesIdx][dataIdx] == 1;
                    },
                    draw: (ctx, cx, cy) => {
                        ctx.beginPath();
                        ctx.rect(cx - 25, cy - 5, 50 * devicePixelRatio, 10 * devicePixelRatio);
                        ctx.stroke();
                    },
                }
            },
            agg: {
                data: Array.from({ length: 10 }, () => Math.random()),
                ranger:{
                    stroke: 'red',
                    fill: 'rgba(255, 155, 84, 0.6)',
                    fillTo: 0,
                },
                profile: {
                    stroke: 'red',
                    fill: 'rgba(255, 155, 84, 0.6)',
                    fillTo: 0,
                    width: 3,
                    label: 'Aggregation',
                    points: {
                        size: 10
                    }
                },
                sequence: {
                    stroke: 'red',
                    fill: 'rgba(255, 155, 84, 0.6)',
                    label: "Aggregation", 
                    display: (threshold, series, seriesIdx, dataIdx, data) => {
                        return data[seriesIdx][dataIdx] > threshold;
                    },
                    draw: null,
                }
            }, 
            asa: {
                data: Array.from({ length: 10 }, () => Math.random()),
                profile: {
                    stroke: 'red',
                    fill: null,
                    dash: [10, 5],
                    label: 'ASA',
                    points: {
                        size: 5
                    }
                },
                sequence: {
                    stroke: 'green',
                    fill: 'rgba(0, 255, 0, 0.2)',
                    label: "Exposure",
                    display: (threshold, series, seriesIdx, dataIdx, data) => {
                        return data[seriesIdx][dataIdx] > threshold;
                    },
                    draw: (ctx, cx, cy) => {
                        ctx.beginPath();
                        ctx.arc(cx, cy, 5 * devicePixelRatio, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                }
            }, 
            tm: {
                data: Array.from({ length: 10 }, () => Math.random()),
                profile: {
                    stroke: 'red',
                    fill: null,
                    label: 'TM',
                    points: {
                        size: 5
                    }
                }
            },
        },
        // Protein 2
        {
            proteinID: {
                data: '8fe1'
            },
            res: {
                data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
            }, 
            aa: {
                data: ["A", "B", null, "D", "E", "F", "G", "H", "I", "J"],
            }, 
            apr: {
                data: [0, 0, 0, 0, 0, 1, 1, 1, 0, 0],
                sequence: {
                    stroke: 'black',
                    fill: 'red',
                    label: "APR",
                    display: (threshold, series, seriesIdx, dataIdx, data) => {
                        return data[seriesIdx][dataIdx] == 1;
                    },
                    draw: (ctx, cx, cy) => {
                        ctx.beginPath();
                        ctx.rect(cx, cy, 5 * devicePixelRatio, 5 * devicePixelRatio);
                        ctx.stroke();
                    },
                }
            },
            agg: {
                data: Array.from({ length: 10 }, () => Math.random()),
                ranger:{
                    stroke: 'green',
                    fill: 'rgba(0, 255, 0, 0.2)',
                    fillTo: 0,
                },
                profile: {
                    stroke: 'green',
                    fill: 'rgba(0, 155, 0, 0.2)',
                    fillTo: 0,
                    width: 3,
                    label: 'Aggregation',
                    points: {
                        size: 10
                    }
                },
                sequence: {
                    stroke: 'blue',
                    fill: 'rgba(0, 0, 255, 0.6)',
                    label: "Aggregation",
                    display: (threshold, series, seriesIdx, dataIdx, data) => {
                        return data[seriesIdx][dataIdx] > threshold;
                    },
                    draw: null,
                }
            }, 
            asa: {
                data: Array.from({ length: 10 }, () => Math.random()),
                profile: {
                    stroke: 'green',
                    fill: null,
                    dash: [10, 5],
                    label: 'ASA',
                    points: {
                        size: 5
                    }
                },
                sequence: {
                    stroke: 'yellow',
                    fill: 'rgba(255, 255, 0, 0.6)',
                    label: "Exposure",
                    display: (threshold, series, seriesIdx, dataIdx, data) => {
                        return data[seriesIdx][dataIdx] > threshold;
                    },
                    draw: (ctx, cx, cy) => {
                        ctx.beginPath();
                        ctx.arc(cx, cy, 5 * devicePixelRatio, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                }
            }, 
            tm: {
                data: Array.from({ length: 10 }, () => Math.random()),
                profile: {
                    stroke: 'green',
                    fill: null,
                    label: 'TM',
                    points: {
                        size: 5
                    }
                }
            },
        },
      ],
    },
    config,
    document.body
  );

*/
// controls
window.addEventListener('load', () => {
    const btn = document.getElementById('set-view-btn');
    const rng = document.getElementById('select-threshold');
    const tgl1 = document.getElementById('toggle1');
    const tgl2 = document.getElementById('toggle2');
    const dpl1 = document.getElementById('display1');
    const dpl2 = document.getElementById('display2');
    const yrng = document.getElementById('yrange');
    const yrngbtn = document.getElementById('yrangebtn');

    btn.addEventListener('click', () => {
        if (chartFunctions !== null) {
            chartFunctions.setView(0,300);
        }
    });

    rng.addEventListener('input', () => {
        if (chartFunctions !== null) {
            chartFunctions.setThresholdValue(rng.value);
        }
    });

    tgl1.onclick = () => {
        if (chartFunctions !== null) {
            chartFunctions.toggleVisibility('LinB');
        }
    }

    tgl2.onclick = () => {
        if (chartFunctions !== null) {
            chartFunctions.toggleVisibility('Rluc');
        }
    }

    dpl1.onclick = () => {
        if (chartFunctions !== null) {
            chartFunctions.displaySequenceAsXLabels('LinB');
        }
    }

    dpl2.onclick = () => {
        if (chartFunctions !== null) {
            chartFunctions.displaySequenceAsXLabels('Rluc');
        }
    }

    yrngbtn.addEventListener('click', () => {
        if (chartFunctions !== null) {
            let s = yrng.value.split(',');
            let min = parseFloat(s[0]);
            let max = parseFloat(s[1]);

            if(!isNaN(min) && !isNaN(max)){
                chartFunctions.setYRange(min,max);
            }
        }
    });
});
