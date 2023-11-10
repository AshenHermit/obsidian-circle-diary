import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, addIcon, } from 'obsidian';
import { CircleDiarySettings, DEFAULT_SETTINGS, OB_CIRCLE_DIARY } from './utils';
import { CircleDiaryView } from './diary-view';
import { DiaryController } from './diary-controller';

// Remember to rename these classes and interfaces!

export default class CircleDiaryPlugin extends Plugin {
	settings: CircleDiarySettings;
	diaryController: DiaryController;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		// Register Main Circle Diary
		this.registerView(OB_CIRCLE_DIARY, this.diaryViewCreator.bind(this));

		// Add Main Circle Diary Ribbon
		const galleryIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-dot-dashed"><path d="M10.1 2.18a9.93 9.93 0 0 1 3.8 0"/><path d="M17.6 3.71a9.95 9.95 0 0 1 2.69 2.7"/><path d="M21.82 10.1a9.93 9.93 0 0 1 0 3.8"/><path d="M20.29 17.6a9.95 9.95 0 0 1-2.7 2.69"/><path d="M13.9 21.82a9.94 9.94 0 0 1-3.8 0"/><path d="M6.4 20.29a9.95 9.95 0 0 1-2.69-2.7"/><path d="M2.18 13.9a9.93 9.93 0 0 1 0-3.8"/><path d="M3.71 6.4a9.95 9.95 0 0 1 2.7-2.69"/><circle cx="12" cy="12" r="1"/></svg>`;
		addIcon('circle-diary', galleryIcon);
		this.addRibbonIcon('circle-diary', "Circle Diary", (e) => {
			this.activateView()
			// this.app.workspace.getLeavesOfType(OB_CIRCLE_DIARY)[0]?.open(this.app.workspace.getLeaf(false).view)
			// this.showPanel()
		});

		this.diaryController = new DiaryController(this.app, this.settings);
		this.diaryController.collectPosts()
	}
	
	onunload() {
		
	}
	
	diaryViewCreator(leaf: WorkspaceLeaf) {
		return new CircleDiaryView(leaf, this);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		let { workspace }  = this.app;
		
		this.diaryController.collectPosts()

		let leaf: WorkspaceLeaf | null = null;
		let leaves = workspace.getLeavesOfType(OB_CIRCLE_DIARY);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			let leaf = workspace.getLeaf(false);
			await leaf.setViewState({ type: OB_CIRCLE_DIARY, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		if(!leaf) return;
		workspace.revealLeaf(leaf);

	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: CircleDiaryPlugin;

	constructor(app: App, plugin: CircleDiaryPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Filepath Filter')
			.setDesc('diary just checks if filepath starts with this string')
			.addText(text => text
				.setPlaceholder('No filepath filter is set')
				.setValue(this.plugin.settings.filepathFilter)
				.onChange(async (value) => {
					this.plugin.settings.filepathFilter = value;
					this.plugin.diaryController.collectPosts()
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName('Accent Color')
		.setDesc('Color of active post circles')
		.addColorPicker(picker => picker
			.setValue(this.plugin.settings.accentColor)
			.onChange(async (value) => {
				this.plugin.settings.accentColor = value;
				await this.plugin.saveSettings();
			}));
	}
}