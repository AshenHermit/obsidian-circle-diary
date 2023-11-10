import { DiaryController, PostInfo } from "./diary-controller";
import { AnimatedValue, CircleDiarySettings, MONTHS, clamp, initializeMouseEvents } from "./utils";
import { SimplexNoise } from "./lib/perlin-simplex";
import { MarkdownView, Menu } from "obsidian";

export class YearCircleRenderer{
    container: HTMLDivElement
	canvas: HTMLCanvasElement;
	centerTextContainer: HTMLDivElement;
    yearTextElement: HTMLDivElement;
    monthTextElement: HTMLDivElement;

    ctx: CanvasRenderingContext2D;
	time: number
	radius: number
	scale: number
	diaryController: DiaryController
    noise: SimplexNoise

    slowViewPositionWalk: number

	isDragging:boolean
	// dragStartMousePos:number

	viewPosition: AnimatedValue
    
    accentColor: string
    settings: CircleDiarySettings

	constructor(container:HTMLDivElement, diaryController:DiaryController, settings:CircleDiarySettings){
        this.container = container
        this.settings = settings
		this.diaryController = diaryController
        
		this.time = 0
		this.scale = 1
		this.isDragging = false
        this.slowViewPositionWalk = 0
		this.viewPosition = new AnimatedValue(0, 3, 10)
        this.noise = new SimplexNoise();
	}
    async setup(){
        await this.setupElements()
		
		this.setupCanvasEventListeners()
        this.setupStyle()
    }
    async setupElements(){
        return new Promise((resolve, reject)=>{
            this.centerTextContainer = this.container.createEl("div", {cls:"center-text-container"})
            this.yearTextElement = this.centerTextContainer.createEl("div", {cls:"year-text",text:"year"})
            this.monthTextElement = this.centerTextContainer.createEl("div", {cls:"month-text",text:"month"})

            this.container.createEl('canvas', undefined, canvas=>{
                this.canvas = canvas
                this.ctx = canvas.getContext('2d')
                resolve(true)
            })
        })
    }
    start(){
        this.diaryController.collectPosts()
        this.diaryController.setLastPostActive()
        if(this.diaryController.activePost){
            this.viewPosition.target = this.diaryController.activePost.position
        }
    }
    
    setupStyle(){
        
    }

	setupCanvasEventListeners(){
		initializeMouseEvents(this.canvas, this.mousedown.bind(this), this.mousemove.bind(this), this.mouseup.bind(this))
        this.canvas.addEventListener("click", this.click.bind(this))
        this.canvas.addEventListener("contextmenu", this.contextmenu.bind(this))
    }
    async contextmenu(e:MouseEvent){
        this.click(e)

        const post = this.diaryController.activePost
        const menu = new Menu()

        if(post){
            menu.addItem((item)=>item.setTitle("Open in Editor").setIcon('edit').onClick(async evt=>{
                this.diaryController.openPostInEditor(post)
            }))
        }
        menu.addItem((item)=>item.setTitle("Place File").setIcon('plus-circle').onClick(async evt=>{
            let newPost = new PostInfo()
            newPost.position = this.viewPosition.target
            this.diaryController.createNewPostWithModal(newPost)
        }))
        if(post){
            menu.addItem((item)=>item.setTitle("Remove From Diary").setIcon('eraser').onClick(async evt=>{
                this.diaryController.removePost(post)
            }))
        }
        menu.showAtPosition({x:e.pageX, y:e.pageY})
    }
    click(e:MouseEvent){
        // this.viewPosition.target
        
        if(this.isDragging){
            this.isDragging = false
            this.mouseIsDown = false
            this.checkNearestPost()
            return
        }
        const rect = this.canvas.getClientRects()[0];
        let dx = e.offsetX - rect.width/2
        let dy = e.offsetY - rect.height/2
        let dvec = [dx, dy]
        let angle = Math.atan2(dy, dx)
        let position = this.angleToPostPosition(angle)
        this.viewPosition.target = position
        this.checkNearestPost()
    }
	mousedown(e:MouseEvent){
        if(e.button != 0) return
        this.dragStartMousePos = e.pageX
        this.mouseIsDown = true
        this.dragStartViewPos = this.viewPosition.target
    }
    mousemove(e:MouseEvent){
        let mouseDelta = (e.pageX - this.dragStartMousePos)
        if(Math.abs(mouseDelta)>2 && this.mouseIsDown){
            this.isDragging = true
        }
        if(this.isDragging){
            this.viewPosition.target = this.dragStartViewPos + mouseDelta/100
        }
    }
    mouseup(e:MouseEvent){
        if(this.isDragging){
            // this.checkNearestPost()
        }
        if(e.target != this.canvas && this.mouseIsDown){
            this.isDragging = false
            this.checkNearestPost()
        }
        this.mouseIsDown = false
    }

    activePostUpdate(){
        if(!this.diaryController.activePost) return
        this.viewPosition.target = this.diaryController.activePost.position
    }

    checkNearestPost()
    {
        const nearestPost = this.diaryController.getNearestPost(this.viewPosition.target)
        if(!nearestPost) return
        this.diaryController.setActivePost(nearestPost)
    }

	update(){
		this.radius = Math.min(this.canvas.width*0.22)

        let oldSlowViewPos = this.viewPosition.slowerValue
		this.viewPosition.update()
        this.slowViewPositionWalk += Math.abs(oldSlowViewPos - this.viewPosition.slowerValue)

		this.resizeCanvas()
        this.updateCenterText()
	}

	postPositionToAngle(position:number){
        const angle_offset = 2 * Math.PI / 12 * 2.5
        let angle = position / 12 * 2 * Math.PI
        angle += angle_offset
        return angle
    }
    angleToPostPosition(angle:number){
        let v = [Math.cos(angle), Math.sin(angle)]
        let viewAngle = this.postPositionToAngle(this.viewPosition.value)
        viewAngle *= -1

        let x2 = v[0] * Math.cos(viewAngle) - v[1] * Math.sin(viewAngle);
        let y2 = v[0] * Math.sin(viewAngle) + v[1] * Math.cos(viewAngle);

        let newAngle = Math.atan2(y2, x2)
        let position = ((12/2)/Math.PI) * newAngle
        position += this.viewPosition.value

        return position;
    }
    updateCenterText(){
        let viewAngle = this.postPositionToAngle(this.viewPosition.slowerValue)
        this.centerTextContainer.style.marginLeft = -(Math.cos(viewAngle)*6)+"px"
        this.centerTextContainer.style.marginTop = -(Math.sin(viewAngle)*6)+"px"

        const position = this.viewPosition.value
        let yearText = this.diaryController.positionToYear(position).toString()
        let monthText = MONTHS[this.diaryController.positionToMonth(position)]

        if(this.yearTextElement.innerText!=yearText)
            this.yearTextElement.innerText = yearText
        
        if(this.monthTextElement.innerText!=monthText)
            this.monthTextElement.innerText = monthText
    }

	drawCircle(){
		this.ctx.lineWidth = 8 * this.scale
        
        let viewPosFractConst = this.viewPosition.slowerValue / 12
        viewPosFractConst = (viewPosFractConst - Math.floor(viewPosFractConst))

        for (let i = 0; i < 12; i++) {
            let month_angle = 2 * Math.PI / 12
            let angle_offset = 2 * Math.PI / 12 / 2
            let scale = 1;

            let viewPosFract = viewPosFractConst * 2 * Math.PI - month_angle * 1.5
            let sinRes = Math.sin(viewPosFract - i * month_angle)
            scale = 1 + (sinRes+1)/10
            this.ctx.globalAlpha = 1-(sinRes/2+0.5)
            this.ctx.lineWidth = 8 * Math.pow(scale, 10)

            // this.ctx.strokeStyle = i%2 == 0 ? "#353535" : "#3f3f3f"
            this.ctx.strokeStyle = "#353535"
            this.ctx.beginPath();
            this.ctx.arc(this.canvas.width/2, this.canvas.height/2, this.radius*scale, 
                angle_offset+i*month_angle, 
                angle_offset+i*month_angle + month_angle*0.95);
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0
        }
	}
	drawViewPosition(){
		let position = this.viewPosition.value
        let angle = this.postPositionToAngle(position)
        
        let x = Math.cos(angle)
        let y = Math.sin(angle)
        
        this.ctx.lineWidth = 5 * this.scale
        this.ctx.strokeStyle = "#fff"
        this.ctx.globalAlpha = 0.1
        this.ctx.beginPath();
        this.ctx.moveTo(
            this.canvas.width/2 + x * (this.radius * 0.5), 
            this.canvas.height/2 + y * (this.radius * 0.5)
        );
        this.ctx.lineTo(
            this.canvas.width/2 + x * (this.radius * 0.8), 
            this.canvas.height/2 + y * (this.radius * 0.8)
        );
        this.ctx.stroke();
        this.ctx.globalAlpha = 1
    }

	drawPost(post:PostInfo){
        let view_position = this.viewPosition.slowerValue
        let post_is_active = post == this.diaryController.activePost
        
        // if(client.is_in_edit_mode && post_is_active){
        //     post = client.edit_mode_post
        // }

        let position = post.position
        let angle = this.postPositionToAngle(position)
        let positionDifference = view_position - position
        if(Math.abs(positionDifference)>5) return

        positionDifference = Math.pow(view_position - position, 2)
        let alpha = clamp(1-Math.abs(positionDifference) / 10, 0, 1) * 0.5

        if(alpha<=0) return

        let centerDistanceOffset = 1 + (positionDifference / 40)
        let noise = this.noise.noise(post.position/3, this.time/500 + this.slowViewPositionWalk/5)
        noise *= 0.06 * (positionDifference / 5 + 0.2)
        let noise2 = this.noise.noise(post.position/3, - this.time/500 - this.slowViewPositionWalk/5)
        noise2 *= 0.1 * (positionDifference / 5 + 0.2)
        centerDistanceOffset = centerDistanceOffset + noise
        
        let x = Math.cos(angle+noise2) * (this.radius) * centerDistanceOffset
        let y = Math.sin(angle+noise2) * (this.radius) * centerDistanceOffset

        this.ctx.globalAlpha = alpha
        this.ctx.lineWidth = 5 * this.scale
        // this.ctx.strokeStyle = post_is_active ? this.settings.accentColor : "#353535"
        this.ctx.strokeStyle = "#fff"
        this.ctx.fillStyle = "#fff"
        let size = post.size
        let title = post.title

        if(post_is_active){
            this.ctx.fillStyle = this.settings.accentColor
            this.ctx.strokeStyle = this.settings.accentColor
            this.ctx.globalAlpha = 1
        }
        size = size * this.radius / 6

        this.ctx.save();
        let font_height = Math.floor(this.radius/35+this.scale*8)
        this.ctx.font = font_height+"px monospace";
        this.ctx.translate(this.canvas.width/2, this.canvas.height/2);
        let offset = 8

        let style = "stroke"
        if(post.style) style = post.style
        
        if(style=="stroke") offset += 2
        if(x > 0){
            this.ctx.rotate(angle+noise2)
            this.ctx.translate(this.radius*centerDistanceOffset+size + offset, 4);
            this.ctx.textAlign = "left"
        }else{
            this.ctx.rotate(angle + Math.PI+noise2)
            this.ctx.translate(-this.radius*centerDistanceOffset-size - offset, 4);
            this.ctx.textAlign = "right"
        }
        this.ctx.fillText(title, 0, 0)
        this.ctx.restore();
        
        this.ctx.beginPath()
        this.ctx.arc(this.canvas.width/2 + x, this.canvas.height/2 + y, size, 0, 2 * Math.PI)
        
        if(style=="fill")
            this.ctx.fill()
        else if(style=="stroke")
            this.ctx.stroke()

        this.ctx.globalAlpha = 1
    }

	drawFrame(){
		this.drawCircle()
		this.drawViewPosition()
        this.diaryController.posts.forEach(post=>{
            this.drawPost(post)
        })
	}
	resizeCanvas(){
		let canvasContainer = this.canvas.parentElement;
		if(canvasContainer == null) return
        var client_rect = canvasContainer.getClientRects()[0]
		if(client_rect == null) return
		let size = Math.min(client_rect.height, client_rect.width)
        // canvasContainer.style.height = size + 'px'
        // client_rect.height = size
        // client_rect.width = size

        let newWidth = client_rect.width * this.scale
        let newHeight = client_rect.height * this.scale

		if(this.canvas.width == newWidth && this.canvas.height == newHeight) return

        this.canvas.width = newWidth
        this.canvas.height = newHeight
	}
	clearFrame(){
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
	}
	animate(){
        if(!this.canvas) return
		this.time+=1
		this.update()
		this.clearFrame()
		this.drawFrame()
	}
}
