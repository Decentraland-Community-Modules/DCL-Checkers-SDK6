/*      PLAYER IDENTIFIER
    used as a character's identification throughout the game's scene
    this also containts a list of trusted sources, ids of users in the
    scene who should be listened to when a resync is occuring.

    Author: Alex Pazder, thecryptotrader69@gmail.com

    Notes: 
    --in this demo we are using peer-to-peer networking. this means each user
    maintains their own versions of data and updates based on the actions of
    other users (peers). by default this system is pretty easy to cheat, as
    long as you can make a call to other players you can assume they will be 
    process your action. 
    
    while learning functionality is more important than security, we will be
    implementing some minor verification by using a trusted source system. basically
    the first user to enter a scene acts as the authority, verifying action requests
    and serving board sync data.
    
    the alternative to program an authentication server, but this requires the server
    to be maintained to keep the game functional. this is not ideal, as if we lose the
    server, we lose the game. we would also have to manage users across multiple game
    instances (realms), which can be quite complex and out of the learning scope of this
    module.
*/
import { getUserData, UserData } from "@decentraland/Identity"
@Component("PlayerIdentifier")
export class PlayerIdentifier extends Entity 
{
    //debugging setting
    public static IsDebugging:boolean;

    //recieved data
    public static USER_DATA:UserData;

    //subscribed board and team
    public static USER_BOARD:number;
    public static USER_TEAM:number;

    //networking bus
    public static MESSAGE_BUS:MessageBus;

    //trusted source for the system
    public static TRUSTED_SOURCE:string|undefined;

    //used to initialize object
    constructor()
    {
        super();
        PlayerIdentifier.IsDebugging = true;

        //prepare message bus
        PlayerIdentifier.MESSAGE_BUS = new MessageBus();
        PlayerIdentifier.TRUSTED_SOURCE = undefined;
    }
}