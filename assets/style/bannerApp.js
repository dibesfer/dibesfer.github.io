
let showBanners = document.getElementById("showBanners");
//Banner creator
class Banner {
    constructor(icon, emoji, title, desc, link) {
        this.icon = icon;
        this.emoji = emoji;
        this.title = title;
        this.desc = desc;
        this.link = link;
        this.category_title = false
    }
    render() {
        let iconContent = this.icon
            ? `<img src="${this.icon}" alt="${this.title}" />`
            : this.emoji;

        if (this.category_title){
          return `
          <h2>${this.emoji} ${this.title}</h2>
          `
        }

        return `
      <div class="bannerApp"
           onclick="window.location.href = '${this.link}'"
          >
            <div class="bannerApp_icon">
            <!-- ICON OR EMOJI -->
             ${iconContent}
            </div>

            <div class="bannerApp_text">
              <!-- TEXT SECTION -->
              <div class="bannerApp_title">
                <!-- Title -->
                ${this.title}
              </div>
              <div class="bannerApp_desc">
                <!-- Desc -->
                ${this.desc}
              </div>
            </div>
          </div>`;
    }
}

let banners = [];
let banner = new Banner();

banner.emoji = "📝";
banner.title = "Blogger";
banner.desc = "Where it all began -> https://dibesfer.blogspot.com";
banner.link = "https://dibesfer.blogspot.com";

banners.push(banner);
banner = new Banner();

banner.emoji = "☸️";
banner.title = "Symbocracy";
banner.desc = "The power and authority of Symbols over Reality";
banner.link = "https://dibesfer.codeberg.page/Symbocracy/";

banners.push(banner);
banner = new Banner();

banner.emoji = "🎵";
banner.title = "musicMaker";
banner.desc = "Make music";
banner.link = "/web/musicMaker/";

banners.push(banner);
banner = new Banner();

banner.icon = "/assets/branding/monochat-logo150.png";
banner.title = "Monochat";
banner.desc = " Realtime anonymous chatting";
banner.link = "https://dibesfer.com/web/chat/";

banners.push(banner);
banner = new Banner();



banner.emoji = "💬";
banner.title = "Fake Language Generator";
banner.desc = "Generate fake language text";
banner.link = "https://dibesfer.com/web/FakeLanguage/";

banners.push(banner);
banner = new Banner();

banner.emoji = "👤";
banner.title = "Fake Users";
banner.desc = "Generate fake user profiles for social media";
banner.link = "https://dibesfer.com/web/FakeUsers/";

banners.push(banner);
banner = new Banner();

banner.emoji = "🪶";
banner.title = "Fake Writer";
banner.desc = "Automatic typewriting fake text";
banner.link = "https://dibesfer.com/web/FakeWriter/";

banners.push(banner);
banner = new Banner();

banner.emoji = "🌀";
banner.title = "Horror Vacui";
banner.desc = "5x5 web iframing";
banner.link = "https://dibesfer.com/web/horrorvacui/";

banners.push(banner);
banner = new Banner();

banner.icon = "/web/javascript/calculator/assets/Calculator_Icon.png";
banner.title = "Calculator";
banner.desc = "Calculate anything";
banner.link = "/web/javascript/calculator/";

banners.push(banner);
banner = new Banner();

banner.emoji = "🪶";
banner.title = "Guestbook";
banner.desc = "Leave your footprint!";
banner.link = "https://dibesfer.com/web/guestbook";

banners.push(banner);
banner = new Banner();

banner.icon = "https://docs.google.com/drawings/d/e/2PACX-1vRH2XVniHMKxShk_RNqI1Kne23uPAedXsMr_AsRP18TaMs2cDxnds7PHW2GJM28hHUR5hgr9ljXY3HE/pub?w=1000&amp;h=1000";
banner.title = "TryIt";
banner.desc = "Realtime web coding";
banner.link = "/web/tryit/";

banners.push(banner);
banner = new Banner();

banner.emoji = "📸";
banner.title = "Graphics";
banner.category_title = true

banners.push(banner);
banner = new Banner();

banner.icon = "/web/SquareFaceCreator/assets/branding/SFC.png";
banner.title = "Square Face Creator";
banner.desc = "Generate custom square faces!";
banner.link = "https://dibesfer.com/web/SquareFaceCreator/";

banners.push(banner);
banner = new Banner();

banner.emoji = "🖌️";
banner.title = "Paint";
banner.desc = "16³ pixel art canvas";
banner.link = "/web/paint";

banners.push(banner);
banner = new Banner();

banner.emoji = "🧊";
banner.title = "VoxelViewer";
banner.desc = "15³ 3D voxel viewer-editor (WIP)";
banner.link = "/web/VoxelViewer";

banners.push(banner);
banner = new Banner();

banner.emoji = "🌳";
banner.title = "BoxelViewer";
banner.desc = "15³ 3D boxel viewer-editor (WIP)";
banner.link = "";

banners.push(banner);

let bannersHTML = ""

banners.forEach((element) => {

  bannersHTML += element.render()

});

showBanners.innerHTML = bannersHTML;
