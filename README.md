# Decentraland_Checkers
  This project provides modular components that facilitate the creation and management of multiple boards hosting Checkers. Boards connectivity is handled via peer-to-peer(P2P) networking, with instance verification through a single source. These modules can be easily implemented into a scene with minimal disruption to current content and can easily be modified to fit into most scenes. The primary uses of this project are to provide a start-point for users interested in creating their own games for DCL and providing a free game that land-owners can implement/play on their land.

Module Components:
  game: main start-file
  dict: list and dictionary implementation, standard collections that allow for easier component management
  PlayerIdentifier: stores player's data, board registrations, and source data
  MenuBuilder: module that creates and manages 3D menu objects
  CheckerBoardManager: manages instances of game boards, generates initial scene when a user first claims source, and manages sync for new players
  CheckerBoard: manages a single game board, processing network commands for the instance of a board
  CheckerMarkerPooling: manages all markers belonging for a single game board

Networking Overview:
  This module uses P2P networking to keep user instances synced during gameplay. When a scene is first initialized the first connected user is established as the source and provides verification for all in-coming commands. When new users connect to the scene they are given current manager/board states from the source, allowing them to sync any games in-progress. When a user makes an action on a board they first verify the action on their side, then send a command request to the source, and (if the source accepts the command) the source executes the change on all connected users.
    While this method provides us with some minor security, its main advantage is scalability: without the need for an authoritative server and by pusing processing on to users, we can effectively host any number of games through any number of instances. If we wanted to achieve a higher level of security we could implement a tri-source P2P network (3 sources that verify each other on command request), but this is beyond the current scope of the project.
    
Known Issues:
Currently None

If you find any issues with the code or need more information regarding its design, you can contact me at: thecryptotrader69@gmail.com
