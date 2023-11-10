export const OB_CIRCLE_DIARY = "ob-circle-diary";
export const OB_CIRCLE_DIARY_INFO = "ob-circle-diary-info";

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const START_YEAR = 2020

type ElementMouseCallback = {
    (this: HTMLElement, ev: MouseEvent) : any
}

export function initializeMouseEvents(
    element:HTMLElement, 
    mousedown_callback:ElementMouseCallback, 
    mousemove_callback:ElementMouseCallback, 
    mouseup_callback:ElementMouseCallback)
{
    element.addEventListener('mousedown', mousedown_callback)
    window.addEventListener('mousemove', mousemove_callback)
    window.addEventListener('mouseup', mouseup_callback)

    element.addEventListener('touchstart', e=>mousedown_callback(e.changedTouches[0]))
    window.addEventListener('touchmove', e=>mousemove_callback(e.changedTouches[0]))
    window.addEventListener('touchend', e=>mouseup_callback(e.changedTouches[0]))
    window.addEventListener('touchcancel', e=>mouseup_callback(e.changedTouches[0]))
}

export class AnimatedValue{
	target: number
	value: number
	slowerValue: number

	smoothness: number
	slowedSmoothness: number

	constructor(initialValue:number, smoothness:number, slowedSmoothness:number){
		this.target = initialValue
		this.value = this.target
		this.slowerValue = this.target

		this.smoothness = smoothness
		this.slowedSmoothness = slowedSmoothness
	}

	update(){
		this.value += (this.target - this.value) / this.smoothness
		this.slowerValue += (this.value - this.slowerValue) / this.slowedSmoothness
	}
}

export const clamp = function(value:number, min:number, max:number){
    return Math.max(min, Math.min(value, max))
}
export const mod = function(x:number, y:number){
    return x - y * Math.floor(x/y)
}

export interface CircleDiarySettings {
	filepathFilter: string;
    accentColor: string;
}

export const DEFAULT_SETTINGS: CircleDiarySettings = {
	filepathFilter: "",
    accentColor: "#ffc677",
}