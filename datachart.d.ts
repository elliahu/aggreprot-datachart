/**
 * Describes dataset for a single protein
 */
export type makeChartDataframe = {
    proteinID: string,
    indexes: number[],
    res: (number | null )[],
    aa: (string | null )[],
    apr: (number | null)[],
    agg: (number | null )[],
    asa: (number | null )[],
    tm: (number | null )[],
}

/**
 * Describes the format of the data passed to the makeChart function
 */
export type makeChartData = {
    dataframes: Array<Omit<makeChartDataframe, "indexes">>,
}

/**
 * Fetches data rom url
 *
 * @param {string} path URL of the data
 * @param {string} format optional format of the data currently only 'json'
 * @returns {makeChartData} fetched data in the internal form
 */
export declare function fetchData(path: string): Promise<makeChartData>

/**
 * Describes grid settings
 */
export type makeChartConfigGridOpts = {
    gridColor:string,
    width: number,
    dash: number[]
}

/**
 * Describes tick settings
 */
export type makeChartConfigTicksOpts = {
    width: number,
    size: number,
    dash: number[]
}

/**
 * Describes a single residue selected from the profile viewer
 */
export type SelectedResidue = {
    position: number,
    selected: boolean,
    protein: string,
}


export type ProteinSeriesStylePoints = {
    show: boolean
}

/**
 * Describes stroke, color and other properties of one dataset (protein)
 */
export type ProteinSeriesStyle = {
    stroke?: string,
    fill?: string,
    fillTo?: number,
    spanGaps?: boolean,
    width?: number,
    dash?: number[],
    points?: ProteinSeriesStylePoints,
}

export const datachart: any;

/**
 * Describes visual configuration such as colors and styles
 */
export type Pallette = {
    threshold?: any,
    ranger?: any[],
    profile?: any[][],
    sequence?: any[][],
    columnHighlightColorHover?: string,
    columnHighlightColorSelected?: string
}

/**
 * Main configuration structure for makeChart function
 */
export type makeChartConfig = {
    debug?: boolean,
    legendAsTooltip?: boolean,
    viewSize?: number,
    onAreaSelected?: (min: number, max: number) => void , // area selected callback fired when area is selected
    labelBreakPoint?: number, // min width between x labels
    grid?: makeChartConfigGridOpts ,
    ticks?: makeChartConfigTicksOpts,
    pallette?: Pallette,
    onResidueSelectedFromProfile?: (positions: SelectedResidue[]) => void,
    columnHighlight?: boolean, // highlight columns on mouse hover
    displayThresholdLineInRanger?: boolean,
    rangerTitle?: string,
    profilePlotTitle?: string,
    sequencePlotTitle?: string,
}

/**
 * This is returned from the makeChart function and functions as a threshold controller and selection callback
 */
export type makeChartResult = {
    onResidueSelectedFromStructure: (position: number, selected: boolean, protein: string) => makeChartResult,
    setThresholdValue: (value: number) => makeChartResult,
    toggleVisibility: (protein: string) => makeChartResult,
    displaySequenceAsXLabels: (protein: string) => makeChartResult,
    clearSelection: (fire: boolean) => makeChartResult,
    setYRange: (min: number, max: number) => makeChartResult,
    setView: (min: number, max: number) => makeChartResult
}

/**
 * Creates the charts
 * @param {makeChartData} data Data in the internal format to be fetched
 * @param {makeChartConfig} config config
 * @param {object} element DOM element where to append the charts
 * @returns {makeChartResult} returns { onResidueSelectedFromStructure }
 */
export declare function makeChart(data: makeChartData, config: makeChartConfig, element: object): makeChartResult
