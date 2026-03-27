
let showBanners = document.getElementById("showBanners");
//Banner creator
class Banner {
    constructor(icon, emoji, title, desc, link) {
        this.icon = icon;
        this.emoji = emoji;
        this.title = title;
        this.desc = desc;
        this.link = link;
    }
    render() {
        let iconContent = this.icon
            ? `<img src="${this.icon}" alt="${this.title}" />`
            : this.emoji;

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



banner.icon = "https://dibesfer.github.io/assets/branding/monochat-logo.png";
banner.title = "Monochat";
banner.desc = " Realtime anonymous chatting";
banner.link = "https://dibesfer.com/web/chat/";

banners.push(banner);
banner = new Banner();

banner.icon = "/web/SquareFaceCreator/assets/branding/SFC.png";
banner.title = "Square Face Creator";
banner.desc = "Generate custom square faces!";
banner.link = "https://dibesfer.com/web/SquareFaceGenerator/";

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


banners.forEach((element) => {
    showBanners.innerHTML += element.render();
});