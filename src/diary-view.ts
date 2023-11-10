import { App, ItemView, WorkspaceLeaf } from "obsidian";
import CircleDiaryPlugin from "./main";
import { OB_CIRCLE_DIARY, initializeMouseEvents } from "./utils";
import { DiaryController } from "./diary-controller";
import { YearCircleRenderer } from "./year-circle-renderer";
import { DiaryPostContainer } from "./diary-post-container";

export class CircleDiaryView extends ItemView {
	plugin: CircleDiaryPlugin
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;

	circleRenderer: YearCircleRenderer
	postContainer: DiaryPostContainer

	canvasContainer: HTMLDivElement
	postContainerEl: HTMLDivElement

	closed: boolean
	time: number
	diaryController: DiaryController

	constructor(leaf: WorkspaceLeaf, plugin: CircleDiaryPlugin){
		super(leaf);
		this.plugin = plugin;
		this.closed = false;
		
		this.diaryController = this.plugin.diaryController;
	}

	getViewType() {
		return OB_CIRCLE_DIARY;
	}

	getDisplayText(){
		return "Circle Diary";
	}
	getIcon(): string {
		return "circle-diary"
	}

	async onOpen() {
		this.closed = false;
		const container = this.containerEl.children[1];
		container.empty();

		let layout = container.createEl("div", {cls: "circle-diary layout"})
		layout.createEl('div', {cls: "circle-container"}, async container=>{
			this.canvasContainer = container
			this.circleRenderer = new YearCircleRenderer(container, this.diaryController, this.plugin.settings)
			await this.circleRenderer.setup()

			this.postContainerEl = layout.createEl('div', {cls: "post-container"})
			this.postContainer = new DiaryPostContainer(this.postContainerEl, this.diaryController)
			this.postContainer.onPostUpdated.subscribe(this.circleRenderer.activePostUpdate.bind(this.circleRenderer))
			this.circleRenderer.start()
		});
		
		this.animationCycle()
	}

	async onClose() {
        // Nothing to clean up.
		this.closed = true;
	}

	animationCycle(){
		if(this.closed) return
        requestAnimationFrame(this.animationCycle.bind(this))
		if(!this.circleRenderer) return
		this.circleRenderer.animate()
    }
}