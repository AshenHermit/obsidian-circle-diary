import { App, ButtonComponent, FuzzySuggestModal, MarkdownView, Modal, SearchComponent, Setting, TFile, WorkspaceLeaf } from "obsidian"
import { EventHandler } from "event-js"
import { CircleDiarySettings, START_YEAR, mod } from "./utils"
import { ArraySuggest } from "./lib/suggest"

// I know that the word "Post" is a little inappropriate here, 
// it would be better to call it "Note", 
// but I wrote "Post" in the original diary code, so I continued here too, but for good reason it needs to be renamed
export class PostInfo{
	position: number
    size: number
	style: undefined|"stroke"|"fill"
	filePath: string
    title: string
	constructor(){
		this.position = 0
		this.size = 1
		this.style = "stroke"
		this.title = "New Diary Note"
	}
	static ALL_STYLES:Array<string> = ["stroke","fill"]
}

export class DiaryController{
	posts:Array<PostInfo>
    activePost:PostInfo
	app:App
	settings:CircleDiarySettings
    
    onActivePostChanged:EventHandler
    onVaultChanged:EventHandler

	processingFrontMatter: boolean

	constructor(app:App, settings:CircleDiarySettings){
		this.app = app
		this.settings = settings
		this.posts = []
		this.processingFrontMatter = false
        
        this.onActivePostChanged = new EventHandler(this)
        this.onVaultChanged = new EventHandler(this)
		this.collectPosts = this.collectPosts.bind(this)
		this.handleFileSystemChange = this.handleFileSystemChange.bind(this)

		this.app.metadataCache.on("changed", (file)=>{
			this.collectPosts()
		})
		this.app.vault.on('modify', this.handleFileSystemChange);
		this.app.vault.on('rename', this.handleFileSystemChange);
		this.app.vault.on('create', this.handleFileSystemChange);
		this.app.vault.on('delete', this.handleFileSystemChange);
	}

	async handleFileSystemChange(file){
		if(this.processingFrontMatter) return
		await this.collectPosts()
		this.onVaultChanged.publish(file)
	}

	positionToYear(pos){
		return START_YEAR + Math.floor(pos/12) 
	}
	positionToMonth(pos){
		return mod(Math.floor(pos), 12)
	}

	getNearestPost(postition:number){
		const posts = this.posts;
        if(posts.length<=0) return
        let nearestPost = null;
        let minDistance = Infinity;
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            const newDistance = Math.abs(post.position-postition)
            if(!nearestPost) {
                nearestPost = post
                minDistance = newDistance
                continue
            }
            if(newDistance < minDistance){
                minDistance = newDistance
                nearestPost = post;
            }
        }
        return nearestPost;
	}
	
	setLastPostActive(){
		const posts = this.posts;
		let lastPost = null;
		for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if(!lastPost || post.position > lastPost.position) {
                lastPost = post
            }
        }
		if(lastPost){
			this.setActivePost(lastPost)
		}
	}

    setActivePost(post:PostInfo|null){
		if(this.activePost==post) return
        this.activePost = post
        this.onActivePostChanged.publish(post)
    }

    getPostFile(post:PostInfo){
        const vault = this.app.vault;
        let file = vault.getAbstractFileByPath(post.filePath)
        return file
    }
    
    async readPostFile(post:PostInfo){
        const vault = this.app.vault;
        const file = this.getPostFile(post) as TFile
        if(!file) return
        return await vault.read(file)
    }

	async openPostInEditor(post:PostInfo){
		let leaf: WorkspaceLeaf | null = null;
		const leaves = this.app.workspace.getLeavesOfType('markdown');
		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = this.app.workspace.getLeaf(false);
		}
		await leaf.setViewState({ type: 'markdown', active: true });
		await leaf.openFile(this.getPostFile(post) as TFile)

		// this.app.workspace.openLinkText(post.filePath, '', 'tab')
	}

	async syncPostWithFile(post:PostInfo){
		this.processingFrontMatter = true
		let file = this.getPostFile(post)
		await this.app.fileManager.processFrontMatter(file as TFile, data=>{
			data["diary-post-position"] = post.position
			data["diary-post-size"] = post.size
			data["diary-post-style"] = post.style
		})
		this.processingFrontMatter = false
	}

	async createNewPostWithModal(post: PostInfo){
		new SearchModal(this, (item)=>{
			post.filePath = item
			post.title = this.getPostFile(post)?.name
			this.posts.push(post)
			this.syncPostWithFile(post)
			this.setActivePost(post)
		}).open()
	}

	removePost(post: PostInfo){
		new DeleteModal(this, (choice)=>{
			if(!choice) return
			this.setActivePost(null)
			post.position = undefined
			this.syncPostWithFile(post)
		}).open()
	}

	checkFileWithFilter(filepath:string){
		return this.settings.filepathFilter && !filepath.startsWith(this.settings.filepathFilter)
	}

	async collectFilesThatAreNotPosts(){
		const vault = this.app.vault;
		let files = <Array<string>> vault.getMarkdownFiles().map(file =>
		{
			if(this.checkFileWithFilter(file.path)) return
			let frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if(!frontmatter){
				return file.path
			}
			let postPosition = frontmatter['diary-post-position']
			if(postPosition===undefined || postPosition===null){
				return file.path
			}
			return
		}).filter(x=>!!x)
		return files
	}

	async collectPosts(){
		const vault = this.app.vault;
		let postsByFilepath = {}
		const posts = this.posts;
		if(posts===undefined) return
		
		posts.forEach(post=>{postsByFilepath[post.filePath] = post})
		const postInfos = <Array<PostInfo>> vault.getMarkdownFiles()
		.map(file =>
		{
			if(this.checkFileWithFilter(file.path)) return

			let frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if(!frontmatter){
				return
			}

			let postPosition = frontmatter['diary-post-position']
			let postSize = frontmatter['diary-post-size']
			let postStyle = frontmatter['diary-post-style']

			if (typeof postPosition !== 'number') return
			
			let postInfo:PostInfo = postsByFilepath[file.path]
			if(!postInfo){
				postInfo = new PostInfo()
			}
			postInfo.filePath = file.path
			postInfo.position = postPosition
			postInfo.size = postSize || 1
			postInfo.style = postStyle || "stroke"
			postInfo.title = file.basename

			return postInfo;
		}
		).filter(x=>x!=null)

		if(postInfos){
			this.posts = postInfos
		}
	}
}


class SearchModal extends Modal {
	diaryController:DiaryController
	callback:(path:string)=>void

	constructor(diaryController:DiaryController, callback:(path:string)=>void) {
		super(diaryController.app);
		this.diaryController = diaryController
		this.callback = callback
	}

	async onOpen() {
		const {contentEl} = this;
		const files = await this.diaryController.collectFilesThatAreNotPosts()
		if(!files || files.length<=0){
			contentEl.createEl('div', {text: 'oh, there are no files that have not yet been placed on diary!'});
			return
		}

		contentEl.createEl('h1', {text: 'Select file to place on diary'});
		
		const search = new SearchComponent(this.contentEl).setPlaceholder('Search Files...');
		const suggest = new ArraySuggest(this.app, search.inputEl, new Set(files))
		suggest.onSelected.subscribe((item)=>{
			this.callback(item)
			this.close()
		})
		search.inputEl.focus()
	} 
}

class DeleteModal extends Modal {
	diaryController:DiaryController
	callback:(choice:boolean)=>void

	constructor(diaryController:DiaryController, callback:(choice:boolean)=>void) {
		super(diaryController.app);
		this.diaryController = diaryController
		this.callback = callback
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl('h1', {text: 'Are you sure?'});
		
		new ButtonComponent(contentEl)
		.setButtonText('Yes')
		.setWarning()
		.onClick(() => {
			this.callback(true)
			this.close()
		});
	} 
}