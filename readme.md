# 🎵 DisMusic

**Your Music, Your Way** - A powerful music streaming platform that aggregates multiple sources into one beautiful interface.

Built with ❤️ by the **Disutils Team**

---

## 🌟 Overview

DisMusic is a comprehensive music streaming application that allows users to search, queue, and play music from multiple platforms including Spotify, YouTube, and more. (Soon) With real-time queue management and a sleek web interface, DisMusic provides a seamless music experience for individuals and teams.

### ✨ Key Features

- 🔍 **Smart Search** - Search across multiple platforms (Spotify, YouTube, etc.) (Soon)
- ⏯️ **Real-time Queue Management** - Live queue updates with drag & drop reordering
- 🎤 **Live Lyrics** - Synchronized lyrics display for your favorite songs (after v1.0)
- 📊 **Music Statistics** - Track listening habits and discover insights (after v1.0)
- 📋 **Playlist Management** - Create, edit, and share playlists
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile (Soon for mobile )
- 🌐 **Multi-platform Support** - Aggregate music from various sources
- 🔄 **Real-time Updates** - Socket.IO powered live synchronization

---

## 🛠️ Tech Stack

### Backend
- **Next.js** - Core application logic
- **Node.js** - High-performance web framework
- **Socket.IO** - Real-time bidirectional communication
- **Discord OAuth** - Authentication system

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with animations
- **JavaScript (ES6+)** - Interactive functionality
- **Socket.IO Client** - Real-time communication

### Additional Tools
- **Git** - Version control
- **RESTful APIs** - External service integration

---

## 🚀 Quick Start

### Prerequisites

- Node.js (for Socket.IO, and Next.js)
- Git

## 🔧 Configuration

### Socket.IO Events

The application uses the following Socket.IO events:

- `connect` - Client connection established
- `disconnect` - Client disconnection
- `play` - Play a specific track
- `next` - Skip to next track
- `queueUpdate` - Real-time queue synchronization
- `playYouTube` - YouTube playback event
- `queueEnded` - Queue completion notification

### API Endpoints

- `GET /` - Main application interface
- `GET /api/search` - Music search endpoint
- `POST /api/queue` - Queue management
- `GET /api/lyrics` - Lyrics retrieval (WIP)
- `GET /api/stats` - User statistics (WIP)
- `POST /auth/discord` - Discord OAuth callback
- `POST /api/user/playlist/create` - Create a new in-house playlist for the user

---

## 🤝 Contributing

We welcome contributions from the community! Please read our [Contributing Guidelines](docs/CONTRIBUTING.md) before submitting pull requests.


---

## 📝 License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0) - see the [LICENSE](LICENSE) file for details.
---

## 👥 Team

**Disutils Team** - A dedicated group of individuals committed to enhancing and simplifying the Discord experience for all users.


- 🌐 Website: [disutils.com](https://disutils.com)
- 📧 Email: [joe@disutils.com ](mailto:joe@disutils.com)
- 💬 Discord: [Join our server](http://disutils.com/discord)

---

## 🐛 Issues & Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/disutils-team/dismusic/issues) page
2. Search for existing solutions
3. Create a new issue with detailed information
4. Join our Discord community for real-time support

---

## 🗺️ Roadmap

### Current Version (1.2A)
- ✅ Basic music streaming
- ✅ Queue management
- ✅ Discord OAuth
- ✅ Real-time synchronization
- ✅ Web interface


### Upcoming Features / WIP (1.3A)
- ✅ Inhouse playlist system! Implemented but buggy
- 🔄 Favorite tracks system
- 🔄 Advanced playlist features
- 🔄 Custom themes
- ✅ Mobile support (responsive design)


### Future Plans (v1.0)
- 🔮 Offline mode
- 🔮 Social sharing
- 🔮 Mobile app (React Native)
- 🔮 AI-powered recommendations
- 🔮 Voice commands
- 🔮 Multi-room audio
- 🔮 Plugin system
- 🔮 Desktop application

---

## 📊 Stats (Repo not public yet)

![GitHub stars](https://img.shields.io/github/stars/disutils/DisMusic?style=social)
![GitHub forks](https://img.shields.io/github/forks/disutils/DisMusic?style=social)
![GitHub issues](https://img.shields.io/github/issues/disutils/DisMusic)
![GitHub license](https://img.shields.io/github/license/disutils/DisMusic)

---


<div align="center">

**Made with 🎵 by the Disutils Team**

[⭐ Star this repo](https://github.com/disutils/DisMusic) • [🐛 Report Bug](https://github.com/disutils/DisMusic/issues) • [💡 Request Feature](https://github.com/disutils/DisMusic/issues)

</div>
