import { DiaryController, PostInfo } from "./diary-controller";
import {EditorView} from "@codemirror/view"
import {EditorState} from "@codemirror/state"
import { MarkdownRenderer, Menu, editorEditorField, editorInfoField } from "obsidian";
import { initializeMouseEvents } from "./utils";
import {EventHandler} from "event-js"

export class ParameterControl{
    container: HTMLElement
    el: HTMLElement
    object:object|null
    key:string

    onValueChanged: EventHandler
    onValueFinallyChanged: EventHandler

    constructor(container:HTMLElement, object:object|null, key:string){
        this.container = container
        this.object = object
        this.key = key
        this.el = this.container.createDiv({cls: "parameter-control"})

        this.onValueChanged = new EventHandler(this)
        this.onValueFinallyChanged = new EventHandler(this)

        initializeMouseEvents(this.el, this.mousedown.bind(this), this.mousemove.bind(this), this.mouseup.bind(this))
        this.el.addEventListener("click", this.click.bind(this))
    }
    getValue(){
        if(!this.object) return null
        return this.object[this.key]
    }
    setValue(value){
        if(!this.object) return
        this.object[this.key] = value
        this.onValueChanged.publish(value)
    }
    setObject(object:object){
        this.object = object
    }

    click(e:MouseEvent){
        
    }
	mousedown(e:MouseEvent){
        
    }
    mousemove(e:MouseEvent){
        
    }
    mouseup(e:MouseEvent){
        
    }
}


export class ParameterSlider extends ParameterControl{
    pxFactor: number

    isDragging: boolean
    dragStartValue: number
    dragStartXPos: number

    minValue: undefined | number

    constructor(container:HTMLElement, object:object|null, key:string, pxFactor:number){
        super(container, object, key)
        this.pxFactor = pxFactor
        this.el.addClass("draggable")
        this.el.innerHTML = `<small>-</small>${this.key}<small>+</small>`
    }
    setValue(value: any): void {
        if(this.minValue!==undefined){
            value = Math.max(this.minValue, value)
        }
        super.setValue(value)
    }
	mousedown(e:MouseEvent){
        if(!this.object) return
        this.isDragging = true
        this.dragStartXPos = e.pageX
        this.dragStartValue = this.getValue()
    }
    mousemove(e:MouseEvent){
        if(!this.object) return
        if(this.isDragging){
            const valueDelta = (e.pageX - this.dragStartXPos) * this.pxFactor
            const newValue = this.dragStartValue + valueDelta
            this.setValue(newValue)
        }
    }
    mouseup(e:MouseEvent){
        if(!this.object) return
        if(this.isDragging){
            this.isDragging = false
            this.onValueFinallyChanged.publish(this.getValue())
        }
    }
}

export class ParameterEnum extends ParameterControl{
    values: Array<string>

    constructor(container:HTMLElement, object:object|null, key:string, values:Array<string>){
        super(container, object, key)
        this.values = values
        this.el.innerHTML = `<small>[</small>${this.key}<small>]</small>`
    }
    click(e: MouseEvent): void {
        const menu = new Menu()
        this.values.forEach(value=>{
            menu.addItem((item)=>item.setTitle(value).onClick(async evt=>{
                this.setValue(value)
                this.onValueFinallyChanged.publish(this.getValue())
            }))
        })
        menu.showAtPosition({x:e.pageX, y:e.pageY})
    }
}

export class DiaryPostContainer{
    diaryController:DiaryController
    container:HTMLDivElement

    postHeader: HTMLDivElement
    titleContainer: HTMLDivElement
    ctrlContainer: HTMLDivElement
    positionControl: ParameterSlider
    sizeControl: ParameterSlider
    styleControl: ParameterEnum
    onPostUpdated: EventHandler

    contentsContainer: HTMLDivElement
    
    currentPost: PostInfo

    constructor(el:HTMLDivElement, diaryController:DiaryController){
        this.diaryController = diaryController;
        this.container = el;

        this.onPostUpdated = new EventHandler(this)

        this.postHeader = this.container.createEl("div", {cls: "post-header"});
        this.titleContainer = this.postHeader.createDiv({cls: "title-container"});
        // controlls
        this.ctrlContainer = this.postHeader.createDiv({cls: "controls-container"});
        this.positionControl = new ParameterSlider(this.ctrlContainer, null, "position", 1/50);
        this.sizeControl = new ParameterSlider(this.ctrlContainer, null, "size", 1/100);
        this.sizeControl.minValue = 0.01;
        this.styleControl = new ParameterEnum(this.ctrlContainer, null, "style", PostInfo.ALL_STYLES);

        [this.positionControl, this.sizeControl, this.styleControl].forEach(x=>{
            x.onValueChanged.subscribe((value)=>{this.postInfoParamsChange()})
            x.onValueFinallyChanged.subscribe((value)=>{this.syncPostInfoParams()})
        })

        this.container.createEl("div", {cls: "contents-container"}, async el=>{
            // this.contentsEditor = new EditorView({
            //     doc: "",
            //     parent: el,
            // })
            this.contentsContainer = el
            
            this.diaryController.onActivePostChanged.subscribe(this.changePost.bind(this))
            this.diaryController.onVaultChanged.subscribe(this.updatePost.bind(this))
        })
    }

    makeToolbar(){
        
    }

    postInfoParamsChange(){
        const post = this.currentPost
        this.onPostUpdated.publish()
    }
    async syncPostInfoParams(){
        const post = this.currentPost
        this.diaryController.syncPostWithFile(post)
        this.onPostUpdated.publish()
    }

    async changePost(post:PostInfo){
        this.currentPost = post
        this.updatePost()
    }
    async updatePost(){
        const post = this.currentPost
        if(!post) return

        this.titleContainer.innerText = post.title

        this.positionControl.setObject(post)
        this.sizeControl.setObject(post)
        this.styleControl.setObject(post)

        // title

        // contents
        const textContents = await this.diaryController.readPostFile(post)
        if(textContents===undefined) return
        
        this.contentsContainer.innerHTML = ""
        MarkdownRenderer.render(window.app, textContents, this.contentsContainer, post.filePath, null)
    }
}