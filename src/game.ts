/*    CHECKERS MODULE DEMO
    this is the classic game of checkers, with multi-board functionality
    a board will accept two users, registering them as the board's players
    any number of boards can exist and be active at any given time, the only
    limitation is that of the scene's body/tri count.
  
    Author: Alex Pazder, thecryptotrader69@gmail.com

    Notes:
    --typescript does not require semi-colons ';' I use them here only because
    the majority of my irl work requires them in the languages we use, so I
    find it easier to keep that practice alive.
    --our debugging logs can be fairly heavy throughout the code, if you notice
    lag throughout the scene and are not interested in the debug calls ensure
    they are toggled off.
    --communications open up in a scene with an attempt at finding the current
    trusted source. this process is split across the checker board and player
    identifier and is outlined below:
        request and wait for user data
        after data is received begin setup,
            building board manager,
            (1)requesting source data,
            (2)setting a timer to verify request completion
        (1)player identifier broadcasts request for scene source
        (1)if there is a source, a response will be sent and source will be set
        (2)after timer completes verification is called
        (2)if there is no trusted source set, a call will be made to make this user the host 
    --general communications happen in 3 stages:
        (1) user requests action
        (2) source processes request
        (3) if action is verified, all users commit action
    this acts as our way of ensuring users can only take correct actions, as
    it requires both the user and source to verify the action. through this we
    can tell when the user is out of pace with our source and when to resync them
*/
import { getUserData, UserData } from "@decentraland/Identity"
import { CheckerBoardManager } from "./CheckerBoardManager";
import { PlayerIdentifier } from "./PlayerIdentifier";

//create player identifier object
//  this object MUST be maintained through the scene
//  as it acts as their key to the game boards
var playerID = new PlayerIdentifier();

//create the board manager and add it to the scene
var boardManager = new CheckerBoardManager(playerID);
engine.addEntity(boardManager);

//attempt to get user's data
let userData = executeTask(async () => 
{
    //wait for data
    const data = await getUserData();
    //if there is received data, load in their details 
    if(data != null) 
    {
        if(PlayerIdentifier.IsDebugging){ log("MAIN: aquirred user data"); }

        //record user's data
        PlayerIdentifier.USER_DATA = data;

        //begin the set up process
        boardManager.NetworkSetup();
    }
    else
    {
        if(PlayerIdentifier.IsDebugging){ log("ERROR: FAILED TO FIND USER DATA!"); }
    }
});