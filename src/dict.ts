 //additions to allow collections to be managed as dictionaries
 //raw source: Dominik Marciniszyn, codetain.com
export interface IKeyCollection<T>
{
    add(key: string, value: T): undefined;
    containsKey(key: string): boolean;
    size(): number;
    getItem(key: string): T;
    removeItem(key: string): T;
    getKeys(): string[];
    values(): T[];
}
export class List<T> {
    private items: Array<T>;

    constructor() {
        this.items = [];
    }

    size(): number {
        return this.items.length;
    }

    add(value: T): void {
        this.items.push(value);
    }

    get(index: number): T {
        return this.items[index];
    }

    remove(value: T): void {
        //shift selected element to last spot in array
        var i:number = 0;
        while(i < this.items.length)
        {
            //if item is found
            if(this.items[i] == value)
            {
                //overwrite targeted item
                this.items[i] = this.items[this.items.length-1];
                //remove duplicate item from end
                this.items.pop();
                break;
            }
            //force next case
            i++;
        }
    }
}
export { Dictionary };
export default class Dictionary<T> implements IKeyCollection<T> 
{
    private items: { [index: string]: T } = {};
    private count: number = 0;

    add(key: string, value: T): undefined {
        if (!this.items.hasOwnProperty(key)) {
            this.count++;
        }

        this.items[key] = value;
        return;
    }

    containsKey(key: string): boolean {
        return this.items.hasOwnProperty(key);
    }

    size(): number {
        return this.count;
    }

    getItem(key: string): T {
        return this.items[key];
    }

    removeItem(key: string): T {
        let value = this.items[key];

        delete this.items[key];
        this.count--;

        return value;
    }

    getKeys(): string[] {
        let keySet: string[] = [];

        for (let property in this.items) {
            if (this.items.hasOwnProperty(property)) {
                keySet.push(property);
            }
        }

        return keySet;
    }

    values(): T[] {
        let values: T[] = [];

        for (let property in this.items) {
            if (this.items.hasOwnProperty(property)) {
                values.push(this.items[property]);
            }
        }

        return values;
    }
}