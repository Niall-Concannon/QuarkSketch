# 🎨 QuarkSketch

---

## 1. Application Name and Description
QuarkSketch is an interactive drawing and guessing game designed for mobile and browser platforms. Players take turns sketching prompts and interpreting drawings created by others. As rounds progress, the original prompts evolve—often in humorous and unexpected ways—creating a fun, collaborative experience.

---

## 2. Problem Statement and Target Users

### Problem Statement
Many existing multiplayer games lack creativity and meaningful interaction. Players often engage passively rather than contributing original content. QuarkSketch addresses this by encouraging active participation through drawing, guessing, and interpreting evolving ideas in real time.

### Target Users
- Casual gamers  
- Friends playing locally or online  
- Students and young adults  
- Fans of drawing/guessing party games  

---

## 3. Key Features Implemented
- Interactive drawing and guessing gameplay  
- Single-player mode with AI scoring  
- Online multiplayer (host/guest room system)  
- Evolving prompts across multiple rounds  
- Local game history tracking  
- Real-time communication using WebSockets  

---

## 4. Architecture Overview

QuarkSketch follows a **client-server architecture**:

### Frontend (Client)
- HTML, CSS, JavaScript  
- Handles UI rendering, drawing canvas, and user interaction  

### Backend (Server)
- Node.js with WebSocket support  
- Manages game state and multiplayer rooms  

### Database
- MySQL for storing game history and scores  

### Communication
- WebSockets enable real-time updates between players  

---

## 5. Technology Stack

### Core Technologies
- HTML  
- CSS  
- JavaScript  

### Backend & Database
- Node.js  
- WebSockets  
- MySQL  

### Development Tools
- VS Code  
- Git & GitHub  
- Jest  

---

## 6. Team Members and Scrum Roles
- [**Niall Concannon**](https://github.com/Niall-Concannon) – Product Owner
- [**Daniel Balcerzak**](https://github.com/BALCER1) – Scrum Master
- [**Kamil Ciemniejewski**](https://github.com/KamilCiemniejewski) – DevOps
- [**Marko Radojcic**](https://github.com/Markoradoj) – Tester 

---

## 7. Project Links
- GitHub Repository: https://github.com/Niall-Concannon/QuarkSketch
- Jira Board: https://atu-team-sa3.atlassian.net/jira/software/projects/SCRUM/boards/1 
- OneNote Documentation: https://atlantictu-my.sharepoint.com/:o:/r/personal/g00436648_atu_ie/Documents/Documents/OneNote%20Notebooks/QuarkStack?d=w10fa751e6a8646c5835a779800725507&csf=1&web=1&e=rjEe1X
- Demo Video: TO BE MADE

---

## 8. Instructions

### Clone
```bash
git clone https://github.com/your-repo/quarksketch.git
cd quarksketch
```

### Build
```bash
npm install
npm run build
```

### Run
```bash
npm start
```

Open in browser:
```
http://localhost:8080
```

---

### Run Test Harness
```bash
npm test
```

### Execute Automated Tests
```bash
npx jest
```

---

### Perform Kit Build
```bash
npm run build
```

---

### Deploy

#### Local Deployment
```bash
npm start
```

#### Cloud Deployment Example
1. Push project to GitHub  
2. Connect repository to a hosting platform (Render, Heroku, or Vercel)  
3. Configure build command:
```
npm install && npm run build
```
4. Configure start command:
```
npm start
```

---

## Additional Notes
- Default multiplayer room size is 2 players  
- WebSocket server should run on the same origin  
- Single-player mode is always available  
