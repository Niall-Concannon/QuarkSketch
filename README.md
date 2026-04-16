# QuarkSketch

## Introduction
QuarkSketch is an interactive mobile drawing and guessing game where players take turns creating sketches based on prompts and interpreting drawings made by others. The game encourages creativity, quick thinking, and collaboration between players as drawings and guesses evolve over multiple rounds. As the game progresses, the original prompts can change in unexpected and often humorous ways, creating entertaining results for everyone involved.

## Objective
The objective of QuarkSketch is for players to participate in a sequence of drawing and guessing rounds. During each round, players will either draw a prompt given to them or attempt to correctly interpret and describe a drawing created by another player. As the rounds continue, drawings and descriptions pass between players, often leading to amusing transformations of the original idea. The goal is to contribute creatively, enjoy the collaborative gameplay, and see how the final result compares to the original prompt.

## Features

- Single-player drawing rounds with AI scoring and local history
- Online host/guest room multiplayer for browser clients

## Online Multiplayer Setup

1. Install dependencies in the repository root:
	`npm install`
2. Start the local web + WebSocket server:
	`npm start`
3. Open two browser windows at `http://localhost:8080`
4. In one window, click Multiplayer -> Create Room
5. In the second window, click Multiplayer -> Join Room and enter the code
6. Host starts the round when both players are in the lobby

### Notes

- Default room size is currently 2 players (host + one guest flow).
- If you deploy to another host, keep the browser and WebSocket endpoint on the same origin where possible.
- You can still play single-player mode exactly as before.


## Technologies Used
### Core Technologies
- **HTML** – Markup language for structuring web content
- **CSS** – Styling and layout of web pages
- **JavaScript** – Interactive and dynamic functionality

### Development Tools
- **VS Code** – Integrated development environment for coding and debugging
- **Git** – Version control system for tracking changes
- **GitHub** – Remote repository hosting for collaboration and code management
- **MySQL** – Database system used to store and manage structured data
- **Jest** - Testing framework used to write and run automated tests to ensure the reliability and correctness of application code

## Team Members
- **Niall Concannon** – [GitHub Profile](https://github.com/Niall-Concannon)
- **Daniel Balcerzak** – [GitHub Profile](https://github.com/BALCER1)
- **Kamil Ciemniejewski** – [GitHub Profile](https://github.com/KamilCiemniejewski)
- **Marko Radojcic** – [GitHub Profile](https://github.com/Markoradoj)
