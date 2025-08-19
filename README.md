# PhotoLive OBS 📸

A real-time photo slideshow application specifically designed for OBS Studio. This application automatically monitors a folder of images and displays them in a web page that you can integrate directly into OBS as a browser source.

> ⚠️ **Security Warning**: This application has been entirely "vibe coded" and may contain security vulnerabilities. It is intended for local development and testing purposes only. Do not expose this application to the internet or use it in production environments without proper security review and hardening.

## ✨ Main Features

- 🔄 **Real-time monitoring** - Automatically detects new images added to the folder
- 🌐 **Web interface for OBS** - Web page optimized for integration into OBS Studio  
- 🎛️ **Control interface** - Control the slideshow via a dedicated web interface
- 🎬 **Smooth transitions** - Fade, slide, zoom with CSS animations
- 🎨 **Visual filters** - Sepia, black & white, blur, brightness, contrast, vintage, etc.
- 🏷️ **Customizable watermark** - Add your text or logo with free positioning
- ⚡ **Real-time updates** - WebSocket for instant synchronization
- 📱 **Responsive interface** - Compatible with all devices
- ⌨️ **Keyboard shortcuts** - Quick slideshow control
- 🔧 **Advanced configuration** - Repeat last images, shuffle, etc.

## 🚀 Installation and startup

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. **Clone or download the project**

```bash
git clone https://github.com/LightD31/photolive-obs.git
cd photolive-obs
```

2. **Install dependencies**

```bash
npm install
```

3. **Start the application**

```bash
npm start
```

The application will be accessible at: `http://localhost:3000`

## 📋 Usage

### Configuration in OBS Studio

1. **Add a "Browser" source** to your OBS scene
2. **Configure the URL**: `http://localhost:3000`
3. **Set dimensions** according to your needs (e.g.: 1920x1080)
4. **Enable "Refresh browser when scene becomes active"** (optional)

### Photo management

1. **Add your images** to the `photos/` folder of the project
2. **Supported formats**: JPG, JPEG, PNG, GIF, BMP, TIFF, WebP
3. **Automatic monitoring** - New images will appear automatically

### Control interface

Access the control interface at: `http://localhost:3000/control`

#### Available controls

- ▶️ **Play/Pause** slideshow
- ⏭️ **Manual navigation** (previous/next)
- ⏱️ **Interval** for image change (1-30 seconds)
- 🎬 **Transitions**: Fade, Slide, Zoom
- 🎨 **Filters**: None, Sepia, B&W, Blur, Brightness, Contrast, Vintage, Cold, Warm
- 🏷️ **Watermark**: Custom text with positioning
- 🔧 **Advanced options**: Repeat last images, shuffle

### Keyboard shortcuts

On the slideshow page (`http://localhost:3000`):

- `→` or `Space`: Next image
- `←`: Previous image  
- `P`: Pause/Play

On the control interface:

- Same shortcuts available (except when typing in a field)

## 🛠️ Configuration

### Folder structure

```text
photolive-obs/
├── server.js              # Main server
├── package.json           # npm configuration
├── config/
│   └── default.json       # Default configuration
├── photos/                # Images folder (to create)
└── public/                # Static web files
    ├── slideshow.html     # Slideshow page for OBS
    ├── control.html       # Control interface
    ├── css/
    │   ├── slideshow.css
    │   └── control.css
    └── js/
        ├── slideshow.js
        └── control.js
```

### Server configuration

The `config/default.json` file contains default settings:

```json
{
  "server": {
    "port": 3000,
    "photosPath": "./photos"
  },
  "slideshow": {
    "defaultInterval": 5000,
    "supportedFormats": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"]
  }
}
```

## 🔧 Development

### Available scripts

- `npm start`: Start production server
- `npm run dev`: Start development server (identical for now)

### REST API

The application exposes a simple REST API:

- `GET /api/images`: List of images with metadata
- `GET /api/settings`: Current slideshow settings
- `POST /api/settings`: Update settings

### WebSocket Events

Events emitted by the server:

- `images-updated`: New list of detected images
- `settings-updated`: Updated settings

Events received from client:

- `next-image`: Show next image
- `prev-image`: Show previous image
- `pause-slideshow`: Pause
- `resume-slideshow`: Resume playback

## 🎯 Use cases

### Live events

- Weddings, concerts, conferences
- Display photos taken in real time during the event

### Streaming

- Integration into Twitch/YouTube streams
- Slideshow during breaks or intermissions

### Presentations

- Automatic display of visual content
- Presentation support with dynamic images

### Photography

- Real-time portfolio for photographers
- Showcase of recent work

## 🔍 Troubleshooting

### Application won't start

- Check that Node.js is installed: `node --version`
- Check that dependencies are installed: `npm install`
- Check that port 3000 is not in use

### Images don't appear

- Check that the `photos/` folder exists
- Check supported image formats
- Check the control interface console for errors

### OBS doesn't load the page

- Check the URL: `http://localhost:3000`
- Test first in a web browser
- Check browser source settings in OBS

### Performance issues

- Reduce image size (recommended: < 2MB per image)
- Limit number of images in folder (< 1000 recommended)
- Increase interval between images

## 📝 License

MIT License - You are free to use, modify and distribute this application.

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Propose new features  
- Improve documentation
- Submit pull requests

## 📞 Support

For any questions or problems:

1. First consult this documentation
2. Check existing issues
3. Create a new issue if necessary

---

**PhotoLive OBS** - Transform your photos into a professional slideshow for OBS Studio! 🎬✨
