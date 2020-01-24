/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    import ValueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import textMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;
    // tslint:disable-next-line:prefer-const
    let formatter : IValueFormatter;

    export module DataViewObjects {
        /** Gets the value of the given object/property pair. */
        export function getValue<T>(objects: DataViewObjects, propertyId: DataViewObjectPropertyIdentifier, defaultValue?: T): T {

            if (!objects) { return defaultValue; }

            const objectOrMap: DataViewObject = objects[propertyId.objectName];

            const object: DataViewObject = <DataViewObject>objectOrMap;

            return DataViewObject.getValue(object, propertyId.propertyName, defaultValue);
        }

        /** Gets an object from objects. */
        export function getObject(objects: DataViewObjects, objectName: string, defaultValue?: DataViewObject): DataViewObject {
            if (objects && objects[objectName]) {
                const object: DataViewObject = <DataViewObject>objects[objectName];

                return object;
            } else {
                return defaultValue;
            }
        }

        /** Gets a map of user-defined objects. */
        export function getUserDefinedObjects(objects: DataViewObjects, objectName: string): DataViewObjectMap {
            if (objects && objects[objectName]) {
                const map: DataViewObjectMap = <DataViewObjectMap>objects[objectName];

                return map;
            }
        }

        /** Gets the solid color from a fill property. */
        export function getFillColor(
            objects: DataViewObjects, propertyId: DataViewObjectPropertyIdentifier, defaultColor?: string): string {
            const value: Fill = getValue(objects, propertyId);
            if (!value || !value.solid) { return defaultColor; }

            return value.solid.color;
        }
    }

    export module DataViewObject {
        export function getValue<T>(object: DataViewObject, propertyName: string, defaultValue?: T): T {

            if (!object) { return defaultValue; }

            // tslint:disable-next-line:no-any
            const propertyValue: any = <T>object[propertyName];
            if (propertyValue === undefined) { return defaultValue; }

            return propertyValue;
        }
        /** Gets the solid color from a fill property using only a propertyName */
        export function getFillColorByPropertyName(objects: DataViewObjects, propertyName: string, defaultColor?: string): string {
            const value: Fill = DataViewObject.getValue(objects, propertyName);
            if (!value || !value.solid) { return defaultColor; }

            return value.solid.color;
        }
    }
    // tslint:disable-next-line:no-any
    const d3Test: any = (<any>window).d3;

    interface IJourneyData {
        nodes: INodes[];
        links: ILinks[];
    }
    interface INodes {
        id: string;
        group: string;
        description: string;
        program: string;
        name: string;
        numberofleads: number;
        percentage: number;
        color: string;
        // tslint:disable-next-line:no-any
        selectionId: any[];
    }
    interface ILinks {
        source: string;
        target: string;
        value: number;
        Activity: string;
    }
    interface INodeDataPoint {
        selectionId: powerbi.visuals.ISelectionId;
    }
    interface ILegendDataPoint {
        category: string;
        value: number;
        color: string;
        selectionId: powerbi.visuals.ISelectionId;
    }

    interface ILegendSettings {
        show: boolean;
    }

    interface IRootSettings {
        showDataLabel: boolean;
        text: string;
        rootOption: string;
        color: string;
    }

    interface ILabelSettings {
        show: boolean;
        labelStyle: string;
        color: string;
        fontSize: number;
        fontFamily: string;
        labelDisplayUnits: number;
        labelDecimalPlace: number;
    }

    export class Visual implements IVisual {
        private target: HTMLElement;
        private updateCount: number;
        private graph: IJourneyData;
        private root: d3.Selection<HTMLElement>;
        private svg: d3.Selection<HTMLElement>;
        private svgLegend: d3.Selection<HTMLElement>;
        public host: IVisualHost;
        private data: IJourneyData;
        private legendDataPoints: ILegendDataPoint[];
        private dataViews: DataView;
        private totalValues: number;
        private catLength: number;
        private idGen: number;
        private measureIdGen: number;
        private tooltipServiceWrapper: ITooltipServiceWrapper;
        private minXView: number;
        private minYView: number;
        private width: number;
        private height: number;
        private formatString: string;
        private measureData: DataViewValueColumns;
        private selectionManager: ISelectionManager;
        public selectionArrayIndex: number;
        public measureDataLengthCount: number;
        public rootCount: number;

        public getDefaultData(): IJourneyData {
            return {
                nodes: [],
                links: []
            };
        }

        public getDistinctElements(val: PrimitiveValue, i: number, self: PrimitiveValue[]): boolean {
            return self.indexOf(val) === i;
        }

        public calAggregate(combinedID: string, totalValues: number): number {
            let sum: number = 0;
            if (combinedID !== 'none') {
                const hierarchyArray: string[] = combinedID.split('***');
                const level: number = hierarchyArray.length - 1;
                let counter: number;
                for (let iRow: number = 0; iRow < totalValues; iRow++) {
                    counter = 0;
                    for (let iLevel: number = 0; iLevel <= level; iLevel++) {
                        if (this.dataViews.categorical.categories[iLevel].values[iRow].toString() === hierarchyArray[iLevel]) {
                            counter += 1;
                            if (counter === level + 1) {
                                sum += parseFloat(this.dataViews.categorical.values[0].values[iRow].toString());
                            }
                        }
                    }
                }

                return sum;
            } else {
                for (let iRow: number = 0; iRow < totalValues; iRow++) {
                    sum += parseFloat(this.dataViews.categorical.values[0].values[iRow].toString());
                }

                return sum;
            }
        }

        public calNodesNLinks(
            // tslint:disable-next-line:no-any
            data: any, catDataset: DataViewCategoryColumn[],
            // tslint:disable-next-line:no-any
            combinedID: string, level: number, parentId: number, parentSum: number, selection: any[]): number {
            if (!catDataset[level]) {
                if (this.measureData.length > 1 && this.measureDataLengthCount > 1) {
                    const splitId: string[] = combinedID.split('***');
                    let cnt: number = 0;
                    for (let iRow: number = 0; iRow < this.totalValues; iRow++) {
                        cnt = 0;
                        for (let cat: number = 0; cat < level; cat++) {
                            if (catDataset[cat].values[iRow].toString() === splitId[cat]) {
                                cnt += 1;
                                if (cnt === level) {
                                    let color: string;
                                    for (let iCounter: number = 0; iCounter < this.legendDataPoints.length; iCounter++) {
                                        if (splitId[0] === this.legendDataPoints[iCounter].category) {
                                            color = this.legendDataPoints[iCounter].color;
                                            break;
                                        } else {
                                            color = '#000';
                                        }
                                    }

                                    for (let iCounter: number = 0; iCounter < this.measureData.length; iCounter++) {
                                        if (!this.measureData[iCounter].source.roles.root) {
                                            const measureNewId: string = (++this.measureIdGen).toString();
                                            // tslint:disable-next-line:no-any
                                            const measureValue: any = isNaN(+(this.measureData[iCounter].values[iRow])) ? '0'
                                                : this.measureData[iCounter].values[iRow];
                                            data.nodes.push({
                                                id: measureNewId,
                                                program: this.measureData[iCounter].source.displayName,
                                                name: this.measureData[iCounter].source.displayName,
                                                group: (level + 1).toString(),
                                                numberofleads: measureValue,
                                                percentage: iCounter === 0 ? 1 : (
                                                    parseFloat(measureValue.toString()) /
                                                    parseFloat(this.measureData[iCounter - 1].values[iRow].toString())),
                                                description: this.measureData[iCounter].source.displayName,
                                                color: color,
                                                selectionId: selection[this.selectionArrayIndex]
                                            });
                                            data.links.push({
                                                source: iCounter === 0 ? parentId.toString() : this.measureIdGen - 1,
                                                target: measureNewId,
                                                value: measureValue,
                                                Activity: ''
                                            });
                                        }
                                    } //end for this.measureData
                                    this.selectionArrayIndex++;
                                } //end if cnt == level
                            } //end if catDataset[cat].values[iRow] == splitId[cat]
                        } //end for cat
                    } // end for iRow
                } //end if this.measureData.length > 1

                return 0;
            } else { // end if !catDataset[level]
                let uniqueElements: PrimitiveValue[];
                const splitId: string[] = combinedID.split('***');
                if (combinedID !== '') {
                    const filteredData: PrimitiveValue[] = [];
                    let cnt: number = 0;
                    for (let iRow: number = 0; iRow < this.totalValues; iRow++) {
                        cnt = 0;
                        for (let cat: number = 0; cat < level; cat++) {
                            if (catDataset[cat].values[iRow].toString() === splitId[cat]) {
                                cnt += 1;
                                if (cnt === level) {
                                    filteredData.push(catDataset[level].values[iRow]);
                                }
                            }
                        }
                    }
                    uniqueElements = filteredData.filter(this.getDistinctElements);

                } else {
                    uniqueElements = catDataset[0].values.filter(this.getDistinctElements);
                }

                uniqueElements.forEach((element: PrimitiveValue) => {
                    // tslint:disable-next-line:no-any
                    const selectionIndId: any[]  = [];
                    let color: string;
                    for (let iCounter: number = 0; iCounter < this.legendDataPoints.length; iCounter++) {
                        if (this.legendDataPoints[iCounter].category === splitId[0] ||
                            this.legendDataPoints[iCounter].category === element.toString()) {
                            color = this.legendDataPoints[iCounter].color;
                            break;
                        } else {
                            color = '#000';
                        }
                    }

                    let newCombinedID: string;
                    const newId: string = (this.idGen++).toString();
                    if (level === 0) {
                        newCombinedID = element.toString();
                    } else {
                        newCombinedID = combinedID;
                        newCombinedID += '***';
                        newCombinedID += element;
                    }
                    const calNumberOfLeads: number = this.calAggregate(newCombinedID, this.totalValues);

                    data.links.push({
                        source: parentId.toString(),
                        target: newId,
                        value: calNumberOfLeads,
                        Activity: ''
                    });

                    data.nodes.push({
                        id: newId,
                        program: catDataset[level].source.displayName,
                        name: element,
                        group: (level + 1).toString(),
                        numberofleads: calNumberOfLeads,
                        percentage: calNumberOfLeads / parentSum,
                        description: newCombinedID,
                        color: color,
                        selectionId: selectionIndId
                    });
                    this.calNodesNLinks(data, catDataset, newCombinedID, level + 1, parseFloat(newId), calNumberOfLeads, selection);

                });
            }
        }

        public converter(dataView: DataView, host: IVisualHost, rootSettings: IRootSettings): IJourneyData {
            let data: IJourneyData = this.getDefaultData();
            if (dataView && dataView.categorical && dataView.categorical.categories && dataView.categorical.categories.length > 0
                && dataView.categorical.values && dataView.categorical.values.length > 0) {
                this.totalValues = dataView.categorical.values[0].values.length;
                this.selectionArrayIndex = 0;
                this.measureDataLengthCount = 0;
                this.rootCount = 0;
                this.catLength = dataView.categorical.categories[0].values.filter(this.getDistinctElements).length;
                this.idGen = 1;
                this.measureIdGen = 10000000;
                this.measureData = dataView.categorical.values;
                const arrIDs: number[] = [];
                const arrCombinedIDs: string[] = [];
                const arrLevel: number[] = [];
                const divider: string = '***';
                const combinedID: string = '';
                const category: string = '';
                const catData: DataViewCategoryColumn[] = dataView.categorical.categories;
                const catLength: number = dataView.categorical.categories.length;
                const rootNode: string = '';
                const totalValues: number = dataView.categorical.categories[0].values.length;
                const rootNodeIndex: number = 0;
                const arrCategoriesMapping: number[] = [];
                this.formatString = dataView.categorical.values[0].source.format;
                // Level 0 mappings
                const rootSum: number = this.calAggregate('none', totalValues);

                const rootText: string  = rootSettings.text;
                const rootLabel: string = rootSettings.rootOption;
                const rootTextProperties: TextProperties = {
                    text: rootText,
                    fontFamily: 'Segoe UI,wf_segoe-ui_semibold,helvetica,arial,sans-serif',
                    fontSize: '15px'
                };

                const selection: INodeDataPoint[] = [];

                // tslint:disable-next-line:no-any
                const categorical: any = dataView.categorical;
                // tslint:disable-next-line:no-any
                const categoryValues: any = categorical.categories[0];
                // tslint:disable-next-line:no-any
                const dataValue: any = categorical.values[0];
                const len: number = Math.max(categoryValues.values.length, dataValue.values.length);
                for (let jCounter: number = 0; jCounter < len; jCounter++) {
                    selection.push({
                        selectionId: host.createSelectionIdBuilder()
                            .withCategory(categoryValues, jCounter)
                            .createSelectionId()
                    });
                }

                data.nodes.push({
                    id: '0',
                    program: textMeasurementService.getTailoredTextOrDefault(rootTextProperties, 140),
                    name: null,
                    group: '0',
                    numberofleads: rootSum,
                    percentage: 1.00,
                    description: combinedID,
                    color: rootSettings.color,
                    selectionId: selection
                });
                data.links.push({
                    source: '0',
                    target: '0',
                    value: this.calAggregate('none', totalValues),
                    Activity: ''
                });

                this.legendDataPoints = [];
                const colorPalette: IColorPalette = host.colorPalette;
                // tslint:disable-next-line:no-any
                const categories: any = jQuery.extend({}, dataView.categorical.categories[0]);
                // tslint:disable-next-line:no-any
                const catValues: any = categories.values.filter(this.getDistinctElements);
                categories.values = catValues;
                for (let iIterator: number = 0; iIterator < categories.values.length; iIterator++) {
                    const defaultColor: Fill = {
                        solid: {
                            color: colorPalette.getColor(categories.values[iIterator].toString()).value
                        }
                    };
                    this.legendDataPoints.push({
                        category: categories.values[iIterator].toString(),
                        value: iIterator,
                        color: getCategoricalObjectValue<Fill>(categories, iIterator, 'colorSelector', 'fill', defaultColor).solid.color,
                        selectionId: host.createSelectionIdBuilder()
                            .withCategory(categories, iIterator)
                            .createSelectionId()
                    });
                }
                //to add root text from Root Data Bag value.
                for (let iCounter: number = 0; iCounter < this.measureData.length; iCounter++) {
                    if (this.measureData[iCounter].source.roles.root) {
                        this.rootCount++;
                    } else {
                        this.measureDataLengthCount++;
                    }
                }
                if (this.rootCount === 1) {
                    if (rootLabel === 'First') {
                        data.nodes[0].name = this.dataViews.categorical.values[this.measureData.length - 1].values[0].toString();
                    } else if (rootLabel === 'Last') {
                        const length: number = this.dataViews.categorical.values[this.measureData.length - 1].values.length;
                        data.nodes[0].name = this.dataViews.categorical.values[this.measureData.length - 1].values[length - 1].toString();
                    }
                } else {
                    data.nodes[0].name = textMeasurementService.getTailoredTextOrDefault(rootTextProperties, 140);
                }
                this.calNodesNLinks(data, catData, '', 0, 0, rootSum, selection);
                data = this.addSelection(catData, data, selection);

                return data;
            }

            return data;

        }

        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            this.target = options.element;
            this.updateCount = 0;
            this.selectionManager = options.host.createSelectionManager();
            this.root = d3Test.select(options.element);
            //div to display error message for category null values.
            // tslint:disable-next-line:no-any
            d3Test.select(options.element).append('div').attr('id', 'errorMessage');
            this.svgLegend = this.root.append('svg');
            this.svg = this.root.append('svg');
            this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);
            this.width = 1000,
                this.height = 500;
            this.minXView = -1 * (this.width / 2.3);
            this.minYView = -1 * (this.height / 2);
        }

        //Function to add selection Ids to each node
        // tslint:disable-next-line:no-any
        public addSelection(catData: DataViewCategoryColumn[], data: any, selection: any[]): IJourneyData {
            const catLen: number = catData.length;
            const measureDataLen: number = this.dataViews.categorical.values.length;
            let jCounter: number = 0;
            let yCounter: number = 0;
            if (measureDataLen === 1 || this.measureDataLengthCount <= 1) {
                for (let iCounter: number = 1; iCounter < data.nodes.length; iCounter++) {
                    if (data.nodes[iCounter].program.toString() ===
                        catData[catLen - 1].source.displayName.toString()) {
                        data.nodes[iCounter].selectionId.push(selection[jCounter]);
                        jCounter++;
                    }
                }
            } else {
                let kCounter: number = 0;
                for (let nCounter: number = 1; nCounter < data.nodes.length; nCounter++) {
                    kCounter = nCounter;
                    if (data.nodes[nCounter].program.toString() ===
                        catData[catLen - 1].source.displayName.toString()) {
                        while (data.nodes[++kCounter].program.toString() !==
                            catData[catLen - 1].source.displayName.toString()) {
                            data.nodes[nCounter].selectionId.push(selection[yCounter]);
                            if (kCounter === data.nodes.length - 1) {
                                break;
                            }
                        }
                        yCounter++;
                    }
                }
            }
            if (catLen > 1) {
                data = this.catLen1(catData, data, catLen, measureDataLen); //for category length grater than 1,
                //add selection ids under that category.
            }
            if (catLen > 2) {
                data = this.catLen2(catData, data, catLen, measureDataLen); //for category length grater than 2.
                //add selection ids under that category.
            }
            if (catLen > 3) {
                data = this.catLen3(catData, data, catLen, measureDataLen); //for category length grater than 3.
                //add selection ids under that category.
            }

            return data;
        }

        // tslint:disable-next-line:no-any
        public catLen1(catData: DataViewCategoryColumn[], data: any, catLen: number, measureDataLen: number): IJourneyData {
            if (measureDataLen === 1 || this.measureDataLengthCount <= 1) {
                let kCounter: number = 0;
                for (let iCounter: number = 1; iCounter < data.nodes.length; iCounter++) {
                    kCounter = iCounter;
                    if (data.nodes[iCounter].program.toString() ===
                        catData[catLen - 2].source.displayName.toString()) {
                        while (data.nodes[++kCounter].program.toString() ===
                            catData[catLen - 1].source.displayName.toString()) {
                            data.nodes[iCounter].selectionId.push(data.nodes[kCounter].selectionId);
                            if (kCounter === data.nodes.length - 1) {
                                break;
                            }
                        }
                    }
                }
            } else {
                let kCounter: number = 0;
                for (let iCounter: number = 1; iCounter < data.nodes.length; iCounter++) {
                    kCounter = iCounter;
                    if (data.nodes[iCounter].program.toString() ===
                        catData[catLen - 2].source.displayName.toString()) {
                        while (data.nodes[++kCounter].program.toString() !==
                            catData[catLen - 2].source.displayName.toString()) {
                            if (data.nodes[kCounter].program.toString() ===
                                catData[catLen - 1].source.displayName.toString()) {
                                data.nodes[iCounter].selectionId.push(data.nodes[kCounter].selectionId);
                            }
                            if (kCounter === data.nodes.length - 1) {
                                break;
                            }
                        }
                    }
                }
            }

            return data;
        }
        // tslint:disable-next-line:no-any
        public catLen2(catData: DataViewCategoryColumn[], data: any, catLen: number, measureDataLen: number): IJourneyData {
            if (measureDataLen === 1 || this.measureDataLengthCount <= 1) {
                let mCounter: number = 0;
                for (let iCounter: number = 1; iCounter < data.nodes.length; iCounter++) {
                    mCounter = iCounter;
                    if (data.nodes[iCounter].program.toString() ===
                        catData[catLen - 3].source.displayName.toString()) {
                        while (data.nodes[++mCounter].program.toString() !==
                            catData[catLen - 3].source.displayName.toString()) {
                            if (data.nodes[mCounter].program.toString() ===
                                catData[catLen - 2].source.displayName.toString()) {
                                data.nodes[iCounter].selectionId.push(data.nodes[mCounter].selectionId);
                            }
                            if (mCounter === data.nodes.length - 1) {
                                break;
                            }
                        }
                    }
                }
            } else {
                let mCounter: number = 0;
                for (let iCounter: number = 1; iCounter < data.nodes.length; iCounter++) {
                    mCounter = iCounter;
                    if (data.nodes[iCounter].program.toString() ===
                        catData[catLen - 3].source.displayName.toString()) {
                        while (data.nodes[++mCounter].program.toString() !==
                            catData[catLen - 3].source.displayName.toString()) {
                            if (data.nodes[mCounter].program.toString() ===
                                catData[catLen - 2].source.displayName.toString()) {
                                data.nodes[iCounter].selectionId.push(data.nodes[mCounter].selectionId);
                            }
                            if (mCounter === data.nodes.length - 1) {
                                break;
                            }
                        }
                    }
                }
            }

            return data;
        }

        // tslint:disable-next-line:no-any
        public catLen3(catData: DataViewCategoryColumn[], data: any, catLen: number, measureDataLen: number): IJourneyData {
            if (measureDataLen === 1 || this.measureDataLengthCount <= 1) {
                let mCounter: number = 0;
                for (let iCounter: number = 1; iCounter < data.nodes.length; iCounter++) {
                    mCounter = iCounter;
                    if (data.nodes[iCounter].program.toString() ===
                        catData[catLen - 4].source.displayName.toString()) {
                        while (data.nodes[++mCounter].program.toString() !==
                            catData[catLen - 4].source.displayName.toString()) {
                            if (data.nodes[mCounter].program.toString() ===
                                catData[catLen - 3].source.displayName.toString()) {
                                data.nodes[iCounter].selectionId.push(data.nodes[mCounter].selectionId);
                            }
                            if (mCounter === data.nodes.length - 1) {
                                break;
                            }
                        }
                    }
                }
            } else {
                let mCounter: number = 0;
                for (let iCounter: number = 1; iCounter < data.nodes.length; iCounter++) {
                    mCounter = iCounter;
                    if (data.nodes[iCounter].program.toString() ===
                        catData[catLen - 4].source.displayName.toString()) {
                        while (data.nodes[++mCounter].program.toString() !==
                            catData[catLen - 4].source.displayName.toString()) {
                            if (data.nodes[mCounter].program.toString() ===
                                catData[catLen - 3].source.displayName.toString()) {
                                data.nodes[iCounter].selectionId.push(data.nodes[mCounter].selectionId);
                            }
                            if (mCounter === data.nodes.length - 1) {
                                break;
                            }
                        }
                    }
                }
            }

            return data;
        }

        public update(options: VisualUpdateOptions): void {
            // tslint:disable-next-line:prefer-const
            let secondaryFormatterVal: number = 0;
            this.svg.selectAll('*').remove();
            this.svgLegend.selectAll('*').remove();
            $('#errorMessage').css('display', 'none');

            const THIS1: this = this;
            let dataView: DataView;
            this.dataViews = dataView = options.dataViews[0];
            // tslint:disable-next-line:no-any
            const categorical: any = dataView.categorical;
            const errorMessageCategory: string = 'Please select Category Data.';
            const errorMessageMeasure: string = 'Please select Measure Data.';
            const errorMessageCategoryNull: string = 'Category value is null.';
            const errorMessageMeasureNull: string = 'Measure value is null.';
            if (categorical.categories === undefined) {  //to display error message if category bag is empty.
                $('#errorMessage').show();
                $('#errorMessage').text(`${errorMessageCategory}`).css({
                    hieght: `${options.viewport.height}px`,
                    width: `${options.viewport.width}px`,
                    'text-align': 'Center',
                    'margin-top': `${options.viewport.height / 3}px`
                });
            } else {  //to display error message for category data having null value.
                for (let iCounter: number = 0; iCounter < categorical.categories.length; iCounter++) {
                    // tslint:disable-next-line:no-any
                    const categoryValues: any = categorical.categories[iCounter];
                    for (let jCounter: number = 0; jCounter < categoryValues.values.length; jCounter++) {
                        if (categoryValues.values[jCounter] === null) {
                            $('#errorMessage').show();
                            $('#errorMessage').text(`${errorMessageCategoryNull}`).css({
                                hieght: `${options.viewport.height}px`,
                                width: `${options.viewport.width}px`,
                                'text-align': 'Center',
                                'margin-top': `${options.viewport.height / 3}px`
                            });
                        }
                    }
                }
            }
            if (categorical.values === undefined) { //to display error message if measure bag is empty.
                $('#errorMessage').show();
                $('#errorMessage').text(`${errorMessageMeasure}`).css({
                    hieght: `${options.viewport.height}px`,
                    width: `${options.viewport.width}px`,
                    'text-align': 'Center',
                    'margin-top': `${options.viewport.height / 3}px`
                });
            } else {  //to display error message for measure data having null value.
                for (let iCount: number = 0; iCount < categorical.values.length; iCount++) {
                    // tslint:disable-next-line:no-any
                    const measureValues: any = categorical.values[iCount];
                    for (let jCount: number = 0; jCount < measureValues.values.length; jCount++) {
                        if (measureValues.values[jCount] === null) {
                            $('#errorMessage').show();
                            $('#errorMessage').text(`${errorMessageMeasureNull}`).css({
                                hieght: `${options.viewport.height}px`,
                                width: `${options.viewport.width}px`,
                                'text-align': 'Center',
                                'margin-top': `${options.viewport.height / 3}px`
                            });
                        }
                    }
                }
            }
            const rootSettings: IRootSettings = this.getRootSettings(this.dataViews);
            const labelSettings: ILabelSettings = this.getLabelSettings(this.dataViews);
            const legendSettings: ILegendSettings = this.getLegendSettings(this.dataViews);
            const data: IJourneyData = this.data = this.converter(dataView, this.host, rootSettings);
            const pxLiteral: string = 'px';
            const spaceLiteral: string = ' ';
            this.svg.selectAll('*').remove();
            this.svgLegend.selectAll('*').remove();
            this.svgLegend
                .attr('width', options.viewport.width)
                .attr('style', 'position: absolute; top: 0; display: inherit; background-color: white');

            const thisObj: Visual = this;

            if (legendSettings.show) {
                this.svgLegend.attr('height', '26.6666');
                let legendWidth: number = (options.viewport.width / (this.catLength + 1));
                legendWidth = legendWidth > 100 ? 100 : legendWidth;
                const group: d3.Selection<HTMLElement> = this.svgLegend
                    .append('g');
                group.selectAll('circle')
                    .data(this.legendDataPoints)
                    .enter()
                    .append('circle')
                    .attr('r', 5)
                    // tslint:disable-next-line:no-any
                    .attr('cx', function (d: any, i: number): number {
                        return (i * legendWidth) + 10;
                    })
                    .attr('cy', 10)
                    .attr('fill', function (d: ILegendDataPoint): string {
                        return d.color;
                    })
                    .attr('class', 'legendCircle')
                    .append('title')
                    .text(function (d: ILegendDataPoint): string {
                        return d.category;
                    });

                group.selectAll('text')
                    .data(this.legendDataPoints)
                    .enter()
                    .append('text')
                    .attr('font-family', 'Segoe UI,wf_segoe-ui_semibold,helvetica,arial,sans-serif')
                    .attr('font-size', 15 + pxLiteral)
                    .attr('x', function (d: ILegendDataPoint, i: number): number {
                        if (i === 0) { return 20; }

                        return (i * legendWidth) + 20;
                    })
                    .attr('y', 15)
                    .text(function (d: ILegendDataPoint): string {
                        const textProperties: TextProperties  = {
                            text: d.category,
                            fontFamily: 'Segoe UI,wf_segoe-ui_semibold,helvetica,arial,sans-serif',
                            fontSize: '15px'
                        };

                        return textMeasurementService.getTailoredTextOrDefault(textProperties, legendWidth - 25);
                    })
                    .append('title')
                    .text(function (d: ILegendDataPoint): string {
                        return d.category;
                    });
            } else {
                this.svgLegend.attr('height', '0');
            }
            // tslint:disable-next-line:no-any
            const max: number = d3Test.max(data.nodes, function (d: any): number {
                if (d.name === 'Root') { return 1; }

                return d.numberofleads;
            });
            // tslint:disable-next-line:no-any
            const linearScale: any = d3Test.scaleLinear().domain([0, max]).range([10, 30]);
            // tslint:disable-next-line:no-any
            const linkLinearScale: any = d3Test.scaleLinear().domain([0, max]).range([2, 10]);
            // tslint:disable-next-line:no-any
            const linkStrengthLevel1Scale: any = d3Test.scaleLog().domain([1, 42500]).range([1, 0.1]).clamp(true);
            // tslint:disable-next-line:no-any
            const linkStrengthLevel2Scale: any = d3Test.scaleLog().domain([1, 42500]).range([1, 0.4]).clamp(true);

            const svg: d3.Selection<HTMLElement> = this.svg;
            svg.attr('width', options.viewport.width) // resizes based on window
                .attr('height', options.viewport.height)
                .attr('viewBox', this.minXView + spaceLiteral + this.minYView + spaceLiteral + this.width + spaceLiteral + this.height)
                .attr('preserveAspectRatio', 'xMidYMid meet');

            const linkDistance: number = 150;
            const manyBodyStrength: number = -200;
            const linkIterations: number = 20;

            // tslint:disable-next-line:no-any
            const color: any = d3Test.scaleOrdinal(d3Test.schemeCategory20);

            // tslint:disable-next-line:no-any
            const simulation: any = d3Test.forceSimulation()
                // tslint:disable-next-line:no-any
                .force('link', d3Test.forceLink().id(function (d: any): any {
                    return d.id;
                    // tslint:disable-next-line:no-any
                }).strength(function (d: any): any {
                    //Set link strength based on effective size of node
                    if (d.target.group.toString() === '1' ||
                        d.target.group.toString() === '2'
                    ) {
                        return linkStrengthLevel1Scale(d.value);
                    } else {
                        return linkStrengthLevel2Scale(d.value);
                    }
                })
                )
                .force('charge', d3Test.forceManyBody().strength(-200))
                .force('center', d3Test.forceCenter(0, 0));
            const link: d3.Selection<ILinks> = svg.append('g')
                .attr('class', 'links')
                .selectAll('line')
                .data(data.links)
                .enter().append('line')
                // tslint:disable-next-line:no-any
                .attr('stroke-width', function (d: ILinks): any { return linkLinearScale(d.value); });
            let node: d3.Selection<INodes>;
            const selectionManager: ISelectionManager = THIS1.selectionManager;
            node = svg.append('g')
                .attr('class', 'nodes')
                .selectAll('circle')
                .data(data.nodes)
                .enter().append('circle')
                .on('click', function (d: INodes): void {     //cross filtering
                    selectionManager.clear();
                    // tslint:disable-next-line:no-any
                    const array: any[] = d.selectionId;
                    // tslint:disable-next-line:no-any
                    const array1: any[] = [];
                    // tslint:disable-next-line:no-any
                    const array2: any[] = [];
                    const j: number = 0;
                    if (array.length === undefined) {

                        array2.push(array);
                        array1.push(array2[0].selectionId);
                    } else {
                        for (let iIndex: number = 0; iIndex < array.length; iIndex++) {
                            if (array[iIndex][0] === undefined) {
                                array1.push(array[iIndex].selectionId);
                            } else if (array[iIndex][0][0] === undefined) {
                                array1.push(array[iIndex][0].selectionId);
                            } else if (array[iIndex][0][0][0] === undefined) {
                                array1.push(array[iIndex][0][0].selectionId);
                            } else if (array[iIndex][0][0][0][0] === undefined) {
                                array1.push(array[iIndex][0][0][0].selectionId);
                            } else if (array[iIndex][0][0][0][0][0] === undefined) {
                                array1.push(array[iIndex][0][0][0][0].selectionId);
                            }
                        }
                    }
                    if ($(this).hasClass('selected')) {
                        $(this).removeClass('selected');
                        $('circle').css('opacity', '1');
                    } else {
                        $('circle').removeClass('selected');
                        $(this).addClass('selected');
                        // tslint:disable-next-line:no-any
                        selectionManager.select(array1).then((ids: any[]) => {
                            $('circle').css('opacity', ids.length > 0 ? 0.5 : 1);
                            $(this).css('opacity', '1');
                        });
                    }
                    (<Event>d3Test.event).stopPropagation();
                })

                // tslint:disable-next-line:no-any
                .attr('r', function (d: INodes): any {
                    if (d.name === 'Root') {
                        return (isNaN(linearScale(max)) ? 0 : linearScale(max));
                    }

                    return isNaN(linearScale(d.numberofleads)) ? 0 : (d.numberofleads < 0 ? 0 : linearScale(d.numberofleads));
                })
                .attr('fill', function (d: INodes): string {
                    return d.color;
                })
                .call(d3Test.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended));

            //to clear selection when clicked on viewport
            this.root.on('click', () => this.selectionManager.clear().then(
                () => $('circle').css('opacity', '1')
            ));
            if (labelSettings.labelDisplayUnits === 0) {
                // get length of value
                const alternateFormatter: number = parseInt(this.dataViews.categorical.values[0].values.toString(), 10).toString().length;
                // add custom logic according to the length of value
                if (alternateFormatter > 9) {
                    secondaryFormatterVal = 1e9;
                } else if (alternateFormatter <= 9 && alternateFormatter > 6) {
                    secondaryFormatterVal = 1e6;
                } else if (alternateFormatter <= 6 && alternateFormatter >= 4) {
                    secondaryFormatterVal = 1e3;
                } else {
                    secondaryFormatterVal = 10;
                }
            }
            const formatter2: IValueFormatter = ValueFormatter.create({
                value: labelSettings.labelDisplayUnits === 0 ? secondaryFormatterVal : labelSettings.labelDisplayUnits,
                precision: labelSettings.labelDecimalPlace
            });
            let text: d3.Selection<INodes>;
            if (labelSettings.show) {
                text = svg.append('g')
                    .attr('class', 'text')
                    .selectAll('text')
                    .data(data.nodes)
                    .enter().append('text')
                    .attr('fill', labelSettings.color)
                    .attr('font-size', labelSettings.fontSize + pxLiteral)
                    .attr('font-family', labelSettings.fontFamily)
                    .text(function (d: INodes): string {
                        if (d.id === '0') {
                            if (rootSettings.showDataLabel === true) {
                                return d.name;
                            }
                        } else {
                            if (labelSettings.labelStyle === 'ShowBoth') {
                                const templateLiteral: string = `${formatter2.format(d.numberofleads)}`;
                                const oBracket: string = ' (';
                                const cBracket: string = ' )';

                                return d.name + oBracket + templateLiteral + cBracket;
                            } else if (labelSettings.labelStyle === 'ShowData') {
                                return d.name;
                            } else if (labelSettings.labelStyle === 'ShowValue') {
                                return `${formatter2.format(d.numberofleads)}`;
                            }
                        }
                    });
            }
            simulation
                .nodes(data.nodes)
                .on('tick', ticked);

            simulation.force('link')
                .links(data.links)
                .distance(linkDistance).iterations(linkIterations);

            // Register events
            svg.on('wheel.zoom', svgMouseWheelHandler);
            svg.call(d3Test.drag().on('drag', svgDragHandler));

            // tslint:disable-next-line:no-any
            function svgMouseWheelHandler(event: any): void {
                const wheelDelta: number = d3Test.event.wheelDeltaY || d3Test.event.deltaY;
                const tempWidth: number = (thisObj.width) + (wheelDelta * -2);
                const tempHeight: number = (thisObj.height) + (wheelDelta * -2);

                if (tempWidth > 0 && tempHeight > 0) {
                    thisObj.minXView = thisObj.minXView + (wheelDelta);
                    thisObj.minYView = thisObj.minYView + (wheelDelta);
                    thisObj.width = tempWidth;
                    thisObj.height = tempHeight;

                    svg.attr('viewBox', thisObj.minXView + spaceLiteral +
                        thisObj.minYView + spaceLiteral + thisObj.width + spaceLiteral + thisObj.height);
                }
            }

            function svgDragHandler(): void {
                thisObj.minXView += -1 * d3Test.event.dx;
                thisObj.minYView += -1 * d3Test.event.dy;
                svg.attr('viewBox', thisObj.minXView + spaceLiteral + thisObj.minYView +
                    spaceLiteral + thisObj.width + spaceLiteral + thisObj.height);
            }
             // tslint:disable-next-line
             let rootx : any;
             // tslint:disable-next-line
             let rooty : any;

            function ticked(): void {
                link
                    // tslint:disable-next-line:no-any
                    .attr('x1', function (d: any): number { return (isNaN(d.source.x) ? 0 : d.source.x); })
                    // tslint:disable-next-line:no-any
                    .attr('y1', function (d: any): number { return (isNaN(d.source.y) ? 0 : d.source.y); })
                    // tslint:disable-next-line:no-any
                    .attr('x2', function (d: any): number { return (isNaN(d.target.x) ? 0 : d.target.x); })
                    // tslint:disable-next-line:no-any
                    .attr('y2', function (d: any): number { return (isNaN(d.target.y) ? 0 : d.target.y); });

                node
                    // tslint:disable-next-line:no-any
                    .attr('cx', function (d: any): number { return (isNaN(d.x) ? 0 : d.x); })
                    // tslint:disable-next-line:no-any
                    .attr('cy', function (d: any): number { return (isNaN(d.y) ? 0 : d.y); });

                if (labelSettings.show) {
                    // tslint:disable-next-line
                    text.attr('x', function (d: any): number {
                        // tslint:disable-next-line:prefer-const
                        let abc: string;
                        if (d.id === '0') {
                            if (rootSettings.showDataLabel === true) {
                                abc = d.name;
                            }
                        } else {
                            if (labelSettings.labelStyle === 'ShowBoth') {
                                const templateLiteral: string = `${formatter2.format(d.numberofleads)}`;
                                const oBracket: string = ' (';
                                const cBracket: string = ' )';

                                abc = d.name + oBracket + templateLiteral + cBracket;
                            } else if (labelSettings.labelStyle === 'ShowData') {
                                abc = d.name;
                            } else if (labelSettings.labelStyle === 'ShowValue') {
                                abc =  `${formatter2.format(d.numberofleads)}`;
                            }
                        }
                       // tslint:disable-next-line
                        let textProperties: TextProperties = {
                            text: abc,
                            fontFamily: labelSettings.fontFamily,
                            // tslint:disable-next-line:prefer-template
                            fontSize: labelSettings.fontSize.toString() + 'px'
                        };
                        if (d.program === 'Root' || d.id === '0') {
                            rootx = d.x;
                            rooty = d.y;
                            d3.select(this).attr('y', d.y - 10);

                            return d.x + linearScale(max) + textMeasurementService.measureSvgTextWidth(textProperties) / 20;
                        } else {
                            // Check if Left
                            if (d.x < rootx) {
                                // tslint:disable-next-line
                                let diff = Math.abs(d.x - rootx);
                                // Top and bottom
                                if (diff < 50) {
                                    // Bottom
                                    if (d.y > rooty) {
                                        d3.select(this).attr('y', d.y + 30 +
                                        textMeasurementService.measureSvgTextHeight(textProperties));
                                    } else {
                                        // Top
                                        d3.select(this).attr('y', d.y - 10 - textMeasurementService.measureSvgTextHeight(textProperties));
                                    }

                                    return d.x - 10;
                                } else {
                                    // Left
                                    d3.select(this).attr('y', d.y + 10);

                                    return d.x - linearScale(d.numberofleads) - textMeasurementService.measureSvgTextWidth(textProperties);
                                }
                            } else {
                                // Right
                                d3.select(this).attr('y', d.y + 10);

                                return d.x + 5 + textMeasurementService.measureSvgTextWidth(textProperties) / 8;
                            }
                        }
                    });
                }
            }
            // tslint:disable-next-line:no-any
            function dragstarted(d: any): void {
                if (!d3Test.event.active) { simulation.alphaTarget(0.3).restart(); }
                d.fx = d.x;
                d.fy = d.y;
            }

            // tslint:disable-next-line:no-any
            function dragged(d: any): void {
                d.fx = d3Test.event.x;
                d.fy = d3Test.event.y;
            }

            // tslint:disable-next-line:no-any
            function dragended(d: any): void {
                if (!d3Test.event.active) { simulation.alphaTarget(0.5); }
                d.fx = null;
                d.fy = null;
            }

            this.tooltipServiceWrapper.addTooltip(
                d3.selectAll('circle'),
                (tooltipEvent: TooltipEventArgs<number>) => this.getTooltipData(tooltipEvent.data),
                (tooltipEvent: TooltipEventArgs<number>) => null);

        }

        // tslint:disable-next-line:no-any
        private getTooltipData(value: any): VisualTooltipDataItem[] {
            formatter = ValueFormatter.create({ format: this.formatString, value: 0, allowFormatBeautification: true, precision: 2 });
            const percentageLiteral: string  = '%';

            return [{
                displayName: value.name,
                value: formatter.format(value.numberofleads)
            }, {
                displayName: 'Percentage',
                value: +(value.percentage * 100).toFixed(2) + percentageLiteral
            }];
        }

        public getLegendSettings(dataView: DataView): ILegendSettings {
            let objects: DataViewObjects = null;
            const settings: ILegendSettings = this.getDefaultLegendSettings();

            if (!dataView || !dataView.metadata || !dataView.metadata.objects) { return settings; }
            objects = dataView.metadata.objects;
            settings.show = DataViewObjects.getValue(
                objects, <DataViewObjectPropertyIdentifier>{ objectName: 'legendSettings', propertyName: 'show' }, settings.show);

            return settings;
        }
        public getRootSettings(dataView: DataView): IRootSettings {
            let objects: DataViewObjects = null;
            const settings: IRootSettings = this.getDefaultRootSettings();

            if (!dataView || !dataView.metadata || !dataView.metadata.objects) { return settings; }
            objects = dataView.metadata.objects;
            settings.text = DataViewObjects.getValue(
                objects, <DataViewObjectPropertyIdentifier>{ objectName: 'rootSettings', propertyName: 'text' }, settings.text);
            settings.showDataLabel = DataViewObjects.getValue(
                objects, <DataViewObjectPropertyIdentifier>{
                    objectName: 'rootSettings',
                    propertyName: 'showDataLabel'
                },
                settings.showDataLabel);
            settings.rootOption = DataViewObjects.getValue(
                objects, <DataViewObjectPropertyIdentifier>{ objectName: 'rootSettings', propertyName: 'rootOption' }, settings.rootOption);
            settings.color = DataViewObjects.getFillColor(
                objects, <DataViewObjectPropertyIdentifier>{ objectName: 'rootSettings', propertyName: 'color' }, settings.color);

            return settings;
        }

        public getLabelSettings(dataView: DataView): ILabelSettings {
            const secondaryFormatterVal: number = 0;
            let objects: DataViewObjects = null;
            const settings: ILabelSettings = this.getDefaultLabelSettings();
            if (!dataView || !dataView.metadata || !dataView.metadata.objects) { return settings; }
            objects = dataView.metadata.objects;
            settings.show = DataViewObjects.getValue(
                objects, <DataViewObjectPropertyIdentifier>{ objectName: 'labelSettings', propertyName: 'show' }, settings.show);
            settings.labelStyle = DataViewObjects.getValue(
                objects, <DataViewObjectPropertyIdentifier>{ objectName:
                     'labelSettings', propertyName: 'labelStyle' },
                settings.labelStyle);
            settings.color = DataViewObjects.getFillColor(
                objects, <DataViewObjectPropertyIdentifier>{ objectName: 'labelSettings', propertyName: 'color' }, settings.color);
            settings.fontSize = DataViewObjects.getValue(
                objects, <DataViewObjectPropertyIdentifier>{ objectName: 'labelSettings', propertyName: 'fontSize' }, settings.fontSize);
            settings.fontFamily = DataViewObjects.getValue(
                objects, <DataViewObjectPropertyIdentifier>{
                    objectName: 'labelSettings', propertyName: 'fontFamily'
                },
                settings.fontFamily);
            settings.labelDisplayUnits = DataViewObjects.getValue(
                    objects, <DataViewObjectPropertyIdentifier>{ objectName: 'labelSettings', propertyName: 'labelDisplayUnits' },
                    settings.labelDisplayUnits);
            settings.labelDecimalPlace = DataViewObjects.getValue(
                    objects, <DataViewObjectPropertyIdentifier>{ objectName: 'labelSettings', propertyName: 'labelDecimalPlace' },
                    settings.labelDecimalPlace);
            settings.labelDecimalPlace = settings.labelDecimalPlace < 0 ? 0
             : settings.labelDecimalPlace > 4 ? 4
             : settings.labelDecimalPlace % 1 !== 0 ? settings.labelDecimalPlace - settings.labelDecimalPlace % 1
            : settings.labelDecimalPlace;

            return settings;
        }

        public getDefaultLegendSettings(): ILegendSettings {
            return {
                show: true
            };
        }

        public getDefaultRootSettings(): IRootSettings {
            return {
                showDataLabel: true,
                text: 'Root',
                rootOption: 'First',
                color: '#000000'
            };
        }

        public getDefaultLabelSettings(): ILabelSettings {
            return {
                show: true,
                labelStyle: 'ShowData',
                color: '#000000',
                fontSize: 25,
                fontFamily: 'Segoe UI',
                labelDisplayUnits: 0,
                labelDecimalPlace: 0
            };
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            const objectName: string = options.objectName;
            const rootSettings: IRootSettings = this.getRootSettings(this.dataViews);
            const labelSettings: ILabelSettings = this.getLabelSettings(this.dataViews);
            const legendSettings: ILegendSettings = this.getLegendSettings(this.dataViews);
            const objectEnumeration: VisualObjectInstance[] = [];
            switch (objectName) {
                case 'legendSettings':
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: 'Legends',
                        selector: null,
                        properties: {
                            show: legendSettings.show
                        }
                    });
                    break;
                case 'colorSelector':
                    let legendData: ILegendDataPoint;
                    for (legendData of this.legendDataPoints) {
                        objectEnumeration.push({
                            objectName: objectName,
                            displayName: legendData.category,
                            properties: {
                                fill: {
                                    solid: {
                                        color: legendData.color
                                    }
                                }
                            },
                            selector: legendData.selectionId.getSelector()
                        });
                    }
                    break;
                case 'rootSettings':
                    if (this.rootCount === 1) {
                        objectEnumeration.push({
                            objectName: objectName,
                            displayName: 'Root Settings',
                            selector: null,
                            properties: {
                                rootOption: rootSettings.rootOption,
                                color: rootSettings.color
                            }
                        });

                    } else {
                        if (rootSettings.showDataLabel) {
                            objectEnumeration.push({
                                objectName: objectName,
                                displayName: 'Root Settings',
                                selector: null,
                                properties: {
                                    showDataLabel: rootSettings.showDataLabel,
                                    text: rootSettings.text,
                                    color: rootSettings.color
                                }
                            });
                        } else {
                            objectEnumeration.push({
                                objectName: objectName,
                                displayName: 'Root Settings',
                                selector: null,
                                properties: {
                                    showDataLabel: rootSettings.showDataLabel,
                                    color: rootSettings.color
                                }
                            });
                        }
                    }

                    break;
                case 'labelSettings':
                if (labelSettings.labelStyle === 'ShowData') {
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: 'Label Settings',
                        selector: null,
                        properties: {
                            show: labelSettings.show,
                            labelStyle: labelSettings.labelStyle,
                            color: labelSettings.color,
                            fontSize: labelSettings.fontSize,
                            fontFamily: labelSettings.fontFamily

                        }
                    });
                } else {
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: 'Label Settings',
                        selector: null,
                        properties: {
                            show: labelSettings.show,
                            labelStyle: labelSettings.labelStyle,
                            labelDisplayUnits: labelSettings.labelDisplayUnits,
                            labelDecimalPlace: labelSettings.labelDecimalPlace,
                            color: labelSettings.color,
                            fontSize: labelSettings.fontSize,
                            fontFamily: labelSettings.fontFamily

                        }
                    });
                }
                break;
                default:
                    break;
            }

            return objectEnumeration;
        }
    }
}
