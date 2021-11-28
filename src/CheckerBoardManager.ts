/*    CHECKERS BOARD MANAGER
    controls the creation, registration, and removal
    of all game boards in the scene
*/
import { List, Dictionary } from "./dict";
import { CheckerBoard, BoardCapsule } from "./CheckerBoard";
import { PlayerIdentifier, SourceCapsule } from "./PlayerIdentifier";
@Component("CheckerBoardManager")
export class CheckerBoardManager extends Entity
{
    initializing:boolean;
    playerID:PlayerIdentifier;

    //returns the next available board index
    getNextIndex():number
    {
        var index:number = 0;
        while(this.checkerBoardDict.containsKey(index.toString()))
        {
            index++;
        }
        return index;
    }

    //collection of all active boards
    checkerBoardList:List<CheckerBoard> = new List<CheckerBoard>();
    checkerBoardDict:Dictionary<CheckerBoard> = new Dictionary<CheckerBoard>();
    //we also maintain a collection of board serial data on-hand
    checkerBoardSerialDict:Dictionary<BoardCapsule> = new Dictionary<BoardCapsule>();
    
    //used to initialize object
    constructor(id:PlayerIdentifier)
    {
        super();
        this.initializing = true;

        //assign player id
        this.playerID = id;

        //add network processing for finding the trusted source, done at this level because it 
        //can result in a board sync
        //  received source sync demand
        //only the source will reply to this request
        PlayerIdentifier.MESSAGE_BUS.on
        (
            "get_source",
            (data : SourceCapsule) =>
            {
                //check if this user is the source
                if(PlayerIdentifier.USER_DATA.userId == PlayerIdentifier.TRUSTED_SOURCE)
                {
                    if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE "+PlayerIdentifier.USER_DATA.displayName+": user="+data.sender+" requested source, sending data"); }

                    //send source data
                    this.playerID.SendSourceData();
                }
                else
                {
                    if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE "+PlayerIdentifier.USER_DATA.displayName+": user="+data.sender+" requested source, I am not source"); } 
                }
            }
        );
        //  received source id
        //all users process this command, setting the new session owner
        //and syncing boards as required
        PlayerIdentifier.MESSAGE_BUS.on
        (
            "sync_source",
            (data : SourceCapsule) =>
            {
                if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE: user="+PlayerIdentifier.USER_DATA.userId+" received source="+data.source+", recording"); }
                
                //record source 
                PlayerIdentifier.TRUSTED_SOURCE = data.source;
                
                //if this user is the source begin sending out current board data
                if(PlayerIdentifier.USER_DATA.userId == PlayerIdentifier.TRUSTED_SOURCE)
                {
                    if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE: user="+PlayerIdentifier.USER_DATA.userId+" is beginning sync across system"); }
                    
                    //process each available board, serializing and sending them across the network
                    for (let i = 0; i < this.checkerBoardList.size(); i++) 
                    { 
                        var index:number = this.checkerBoardList.get(i).Index();
                        //prepare capsule for sending
                        this.checkerBoardDict.getItem(index.toString()).SaveBoardToSerial(this.checkerBoardSerialDict.getItem(index.toString()));

                        
                        //send data
                        PlayerIdentifier.MESSAGE_BUS.emit("sync_board", this.checkerBoardSerialDict.getItem(index.toString()));
                    }
                }
            }
        );
        //  received board serial
        //all users except the  must abide this command, syncs all boards to the state of current host
        PlayerIdentifier.MESSAGE_BUS.on
        (
            "sync_board",
            (data : BoardCapsule) =>
            {//we only need to process inbound board data if we are not the trusted source
                if(PlayerIdentifier.USER_DATA.userId != PlayerIdentifier.TRUSTED_SOURCE 
                    && data.sender == PlayerIdentifier.TRUSTED_SOURCE
                )
                {
                    if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE: user "+PlayerIdentifier.USER_DATA.userId+" received a board serial, preparing a board from data"); }
                
                    //create a board based on this data
                    //  check if board of requested index exsists
                    if(!this.checkerBoardDict.containsKey(data.id.toString()))
                    {
                        //create a checker board for specific id
                        var board = new CheckerBoard(data.id);
                        board.setParent(this);
                
                        const dataCap:BoardCapsule = {sender:"", id:0, serial_state:"", serial_markers:"" };
                        //add board to collections
                        this.checkerBoardList.add(board);
                        this.checkerBoardDict.add(board.Index().toString(), board);
                        this.checkerBoardSerialDict.add(board.Index().toString(), dataCap);
                    }
                    //load board from serial data
                    this.checkerBoardDict.getItem(data.id.toString()).LoadBoardFromSerial(data);
                }
            }
        );
    }

    //ensures the player has a source recorded
    public VerifyRegistration()
    {
        if(PlayerIdentifier.IsDebugging){ log("MESSAGE BUS RECEIVE "+PlayerIdentifier.USER_DATA.displayName+": processing verification request"); } 
        //check if there is a source
        if(PlayerIdentifier.TRUSTED_SOURCE == undefined)
        {
            if(PlayerIdentifier.IsDebugging){ log(PlayerIdentifier.USER_DATA.displayName+" user="+PlayerIdentifier.USER_DATA.userId+" is becoming the initial trusted source"); }

            //SOURCE START-UP
            //create and position a board from the manager
            //create first
            var activeBoardIndex1 = this.CreateCheckerBoard();
            this.PositionCheckerBoard(activeBoardIndex1, 4, 1, 6);
            //create second
            //var activeBoardIndex2 = this.CreateCheckerBoard();
            //this.PositionCheckerBoard(activeBoardIndex2, 4, 0, 10);

            //set self as host for scene
            this.playerID.SendSourceData();
        }
    }

    //creates and readies a board, returns its access index
    public CreateCheckerBoard():string
    {
        //create a checker board
        var board = new CheckerBoard(this.getNextIndex());
        board.setParent(this);

        const data:BoardCapsule = {sender:"", id:0, serial_state:"", serial_markers:"" };
        //add board to collections
        this.checkerBoardList.add(board);
        this.checkerBoardDict.add(board.Index().toString(), board);
        this.checkerBoardSerialDict.add(board.Index().toString(), data);

        return board.Index().toString();
    }

    //removes a board from the scene, completely dropping it from
    //  collections and engine
    public RemoveCheckerBoard(index:number)
    {
        //get board from collections
        var board = this.checkerBoardDict.getItem(index.toString());

        //remove board from engine
        board.setParent(null);

        //remove board from collections
        this.checkerBoardList.remove(board);
        this.checkerBoardDict.removeItem(index.toString());
        this.checkerBoardSerialDict.removeItem(index.toString());
    }

    //sets the position of a given board
    public PositionCheckerBoard(index:string, x:number, y:number, z:number)
    {
        //position board
        this.checkerBoardDict.getItem(index).SetPosition(x,y,z);
    }
}