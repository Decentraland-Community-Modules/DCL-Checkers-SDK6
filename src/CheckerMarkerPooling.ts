/*      CHECKER MARKER POOLING
    system used to create markers for a board, one pooling
    system exsists per board. This creates a little over-head
    per board creation, but is worth it in the long-run to
    cut down on lost dependancies.
    
    Author: Alex Pazder, thecryptotrader69@gmail.com

    NOTES: 
    --we can trust most of the data from the marker and pool
    as access to it is locked behind the board, but it is still best
    practice to only allow the bare minimum access to variables.

    --when a turn starts we check if the current team can make at least
    a single move. if they cannot and the board is locked, then the current
    team loses the game
    
    --when a marker is selected all available actions are displayed
    for the first jump. as soon as one jump is made the moved marker
    becomes locked for use until all jumps have been completed.
*/
import { Dictionary } from "./dict";
@Component("CheckerMarkerPool")
export class CheckerMarkerPool extends Entity 
{
    //debugging setting
    public static IsDebugging:boolean;
    //debugging with many statements
    public static IsVerbose:boolean;

    //how many tiles exsist on each of the board's vectors
    private grid_size_x = 8;
    private grid_size_y = 8;

    //material for action marker
    private actionMarkerMaterial:Material;
    public actionMarkers:ActionMarker[];
    public ActionMarkerDict:Dictionary<ActionMarker>;

    //we are currently cannot change imported object's material dynamically,
    //  so we will manage colour by assigning seperate textures 
    private marker_locations:string[] = ["models/Marker_0.glb","models/Marker_1.glb"];

    //currently selected marker
    private selectedMarker:CheckerMarker|undefined;
    public HasSelectedMarker():boolean
    {
        if(this.selectedMarker != undefined){ return true; }
        return false;
    }

    //collection of all exsisting markers
    //  access key is: <team_index>+"_"+<marker_index>
    private marker_dict = new Dictionary<CheckerMarker>();
    //returns a string key based on the given tile position
    public GetMarkerIndex(team:number, index:number):string 
    { 
        return team.toString() + "_" + index.toString(); 
    }
    //returns the marker belonging to the given team and of the given index
    public GetMarkerByTeam(team:number, index:number):CheckerMarker
    {
        return this.marker_dict.getItem(this.GetMarkerIndex(team,index));
    }

    //collection of all occupied tiles on the board
    //  access key is: <tile_x>+"_"+<tile_y>
    private occupied_dict = new Dictionary<CheckerMarker>();
    //returns a string key based on the given tile position
    public GetTileIndex(x:number, y:number):string 
    { 
        return x.toString() + "_" + y.toString(); 
    }
    //determines if the given position is a real position on the board
    public IsTileInbounds(x:number, y:number):boolean
    {
        if(x >= 0 && x <= 7 && y >= 0 && y <= 7)
        {
            return true;
        }
        return false;
    }
    //returns true if the given position is occupied
    public IsTileOccupied(x:number, y:number):boolean
    {
        if(this.occupied_dict.containsKey(this.GetTileIndex(x,y)))
            return true;

        return false;
    }
    //returns the marker 
    public GetMarkerByPosition(x:number, y:number):CheckerMarker
    {
        return this.occupied_dict.getItem(this.GetTileIndex(x, y));
    }

    //used to initialize pooling system
    constructor()
    {
        //initialize
        super();

        //set the initial transform to below the board
        this.addComponent(new Transform
        ({
          position: new Vector3(0,0,0),
          scale: new Vector3(1,1,1),
          rotation: new Quaternion().setEuler(0,0,0)
        }));
    
        //prepare action marker material
        this.actionMarkerMaterial = new Material();
        this.actionMarkerMaterial.emissiveColor = new Color3(0.2,0.2,0);
        this.actionMarkerMaterial.albedoColor = new Color4(1,1,0,0.6);

        //prepare action marker objects
        this.actionMarkers = [new ActionMarker(), new ActionMarker(), new ActionMarker(), new ActionMarker()];
        this.ActionMarkerDict = new Dictionary<ActionMarker>();
        for (let i = 0; i < 4; i++) 
        {
            this.actionMarkers[i].setParent(this);

            //Assign the material to the entity
            this.actionMarkers[i].addComponent(this.actionMarkerMaterial);
        }
        //hide all action markers by default
        this.HideActionMarkers();

        //fill pool with markers for each team
        for (let team = 0; team < 2; team++) 
        { 
            for (let x = 0; x < 12; x++) 
            {
                //create new marker object
                var cur_marker = new CheckerMarker(team, x, this.marker_locations[team]);
                cur_marker.setParent(this);
    
                //add to marker collection
                this.marker_dict.add(this.GetMarkerIndex(team,x), cur_marker);
            }
        }
    }

    //saves the marker pool's current state as a serial string
    public SaveToSerial(team:number):string
    {
        var serial:string = "";

        //process each marker
        for(let index:number=0; index<12; index++)
        {
            //set position
            serial += this.GetMarkerByTeam(team, index).Assignment[0]+":"+this.GetMarkerByTeam(team, index).Assignment[1];
            //set states
            //we are going to simplify states into numbers to reduce network traffic
            if(this.GetMarkerByTeam(team, index).Captured) { serial += ":1"; } else { serial += ":0" }
            if(this.GetMarkerByTeam(team, index).Enhanced) { serial += ":1"; } else { serial += ":0"; }
            //seperator for each marker def
            serial += "_";
        }

        return serial;
    }

    public LoadFromSerial(serial:string)
    {
    }

    //hides all action markers
    public HideActionMarkers()
    {
        for (let i = 0; i < this.actionMarkers.length; i++) 
        {
            this.HideActionMarker(i);
        }
    }

    //hides the action marker of the given index
    public HideActionMarker(index:number)
    {
        if(CheckerMarkerPool.IsDebugging && CheckerMarkerPool.IsVerbose){ log("hiding action marker: "+index.toString());}
        
        //if action marker is active, remove from collection
        if(this.ActionMarkerDict.containsKey(this.GetTileIndex(this.actionMarkers[index].Assignment[0],this.actionMarkers[index].Assignment[1])))
        {
            //remove from collections
            this.ActionMarkerDict.removeItem(this.GetTileIndex(this.actionMarkers[index].Assignment[0],this.actionMarkers[index].Assignment[1]));
        }
        //reset action marker
        this.actionMarkers[index].Reset();
    }

    //moves the given action marker to the given location
    public MoveActionMarker(index:number, x:number, y:number, position:Vector3)
    {
        if(CheckerMarkerPool.IsDebugging && CheckerMarkerPool.IsVerbose){ log("placing action marker "+index.toString()+": "+x.toString()+", "+y.toString());}
        //display object
        this.actionMarkers[index].setParent(this);
        //add to collection
        this.ActionMarkerDict.add(this.GetTileIndex(x,y),this.actionMarkers[index]);
        //place object at given location
        this.actionMarkers[index].Assignment[0] = x;
        this.actionMarkers[index].Assignment[1] = y;
        this.actionMarkers[index].getComponent(Transform).position = position;
    }
    
    //returns true if a given marker has actions remaining
    public DoesMarkerHaveActions(jumpsOnly:boolean):boolean
    {
        //if there is no marker selected, just return false
        if(this.selectedMarker == undefined)
        {
            return false;
        }

        //place all action markers
        this.PlaceActionMarkers(jumpsOnly);

        //look through each action marker
        for (let i=0; i<this.actionMarkers.length; i++) 
        {
            //if marker is active
            if(this.actionMarkers[i].Assignment[0] != -1
                &&this.actionMarkers[i].Assignment[1] != -1)
            {
                return true;
            }
        }

        //no action marker was found
        return false;
    }

    //returns true if the given location tile has an action marker assigned to it
    public IsLocationOnActionMarker(x:number, y:number):boolean
    {
        for(let i:number=0; i<this.actionMarkers.length; i++)
        {
            if(this.actionMarkers[i].Assignment[0] == x
            && this.actionMarkers[i].Assignment[1] == y)
            {
                return true;
            }
        }
        return false;
    }

    //populates and sets possible action markers for the selected marker
    //  when 'jumpOnly' is true, only moves that jump over enemy targets will be shown
    //we're going to do this in a verbose straight-forward fashion, entering every case,
    //which will make this quite long but easier to debug and understand. in future
    //iterations we'll likely use a number array mask to filter acceptable cases.
    public PlaceActionMarkers(jumpOnly:boolean)
    {
        this.HideActionMarkers();
    
        //ensure there is a marker 
        var tarX:number;
        var tarY:number;
        if(this.selectedMarker != undefined)
        {
          //if game has not started or (team red or enhanced)
          if(this.selectedMarker.Team() == 0 || this.selectedMarker.Enhanced)
          {
            //test each marker
            //  bottom left square
            //    if target tile is open
            tarX = this.selectedMarker.Assignment[0]+1;
            tarY = this.selectedMarker.Assignment[1]+1;
            if(!this.IsTileOccupied(tarX, tarY)
              && this.IsTileInbounds(tarX, tarY)
              && !jumpOnly)
            {
              this.MoveActionMarker(0, tarX, tarY, this.getTilePosition(tarX, tarY));
            }
            //    if target tile is occupied by an enemy and the next tile is free
            else if(this.IsTileOccupied(tarX, tarY)
                && this.IsTileInbounds(tarX, tarY)
                && !this.IsTileOccupied(tarX+1, tarY+1)
                && this.IsTileInbounds(tarX+1, tarY+1)
                && this.GetMarkerByPosition(tarX, tarY).Team() != this.selectedMarker.Team()
            )
            {
              this.MoveActionMarker(0, tarX+1, tarY+1, this.getTilePosition(tarX+1, tarY+1));
              this.actionMarkers[0].HasJumpTarget = true;
              this.actionMarkers[0].JumpTarget[0] = tarX;
              this.actionMarkers[0].JumpTarget[1] = tarY;
            }
            //  bottom right square
            //    if target tile is open
            tarX = this.selectedMarker.Assignment[0]-1;
            tarY = this.selectedMarker.Assignment[1]+1;
            if(!this.IsTileOccupied(tarX, tarY)
            && this.IsTileInbounds(tarX, tarY)
            && !jumpOnly)
            {
              this.MoveActionMarker(1, tarX, tarY, this.getTilePosition(tarX, tarY));
            }
            //    if target tile is occupied by an enemy and the next tile is free
            else if(this.IsTileOccupied(tarX, tarY)
                && this.IsTileInbounds(tarX, tarY)
                && !this.IsTileOccupied(tarX-1, tarY+1)
                && this.IsTileInbounds(tarX-1, tarY+1)
                && this.GetMarkerByPosition(tarX, tarY).Team() != this.selectedMarker.Team()
            )
            {
              this.MoveActionMarker(1, tarX-1, tarY+1, this.getTilePosition(tarX-1, tarY+1));
              this.actionMarkers[1].HasJumpTarget = true;
              this.actionMarkers[1].JumpTarget[0] = tarX;
              this.actionMarkers[1].JumpTarget[1] = tarY;
            }
          }
          //if game has not started or (team blue or enhanced)
          if(this.selectedMarker.Team() == 1 || this.selectedMarker.Enhanced)
          {
            //test each marker
            //  top right square
            //    if target tile is open
            tarX = this.selectedMarker.Assignment[0]-1;
            tarY = this.selectedMarker.Assignment[1]-1;
            if(!this.IsTileOccupied(tarX, tarY)
            && this.IsTileInbounds(tarX, tarY)
            && !jumpOnly)
            {
              this.MoveActionMarker(2, tarX, tarY, this.getTilePosition(tarX, tarY));
            }
            //    if target tile is occupied by an enemy and the next tile is free
            else if(this.IsTileOccupied(tarX, tarY)
                && this.IsTileInbounds(tarX, tarY)
                && !this.IsTileOccupied(tarX-1, tarY-1)
                && this.IsTileInbounds(tarX-1, tarY-1)
                && this.GetMarkerByPosition(tarX, tarY).Team() != this.selectedMarker.Team()
            )
            {
              this.MoveActionMarker(2, tarX-1, tarY-1, this.getTilePosition(tarX-1, tarY-1));
              this.actionMarkers[2].HasJumpTarget = true;
              this.actionMarkers[2].JumpTarget[0] = tarX;
              this.actionMarkers[2].JumpTarget[1] = tarY;
            }
            //  top left square
            //    if target tile is open
            tarX = this.selectedMarker.Assignment[0]+1;
            tarY = this.selectedMarker.Assignment[1]-1;
            if(!this.IsTileOccupied(tarX, tarY)
            && this.IsTileInbounds(tarX, tarY)
            && !jumpOnly)
            {
              this.MoveActionMarker(3, tarX, tarY, this.getTilePosition(tarX, tarY));
            }
            //    if target tile is occupied by an enemy and the next tile is free
            else if(this.IsTileOccupied(tarX, tarY)
                && this.IsTileInbounds(tarX, tarY)
                && !this.IsTileOccupied(tarX+1, tarY-1)
                && this.IsTileInbounds(tarX+1, tarY-1)
                && this.GetMarkerByPosition(tarX, tarY).Team() != this.selectedMarker.Team()
            )
            {
              this.MoveActionMarker(3, tarX+1, tarY-1, this.getTilePosition(tarX+1, tarY-1));
              this.actionMarkers[3].HasJumpTarget = true;
              this.actionMarkers[3].JumpTarget[0] = tarX;
              this.actionMarkers[3].JumpTarget[1] = tarY;
            }
          }
        }
        //if no marker is selected then hide all actions
        else
        {
          this.HideActionMarkers();
        }
    }

    //selects a marker by grabbing accessing its position, elevating its position
    //  jumped determines if this marker has already moved
    public SelectMarker(jumped:boolean, x:number, y:number)
    {
        //ensure if tile is occupied by a marker
        if(this.IsTileOccupied(x,y))
        {
            //if there is a selected marker and the new target is the already selected marker
            if(this.selectedMarker != undefined
                && this.selectedMarker.Index() == this.occupied_dict.getItem(this.GetTileIndex(x,y)).Index()
            )
            {
                if(CheckerMarkerPool.IsDebugging){ log("deselected marker: " + this.selectedMarker.Index());}
                //attempt to deselect marker
                this.DeselectMarker();
            }
            else
            {
                //attempt to deselect marker
                this.DeselectMarker();

                //select new marker and change positioning
                this.selectedMarker = this.occupied_dict.getItem(this.GetTileIndex(x,y));
                this.selectedMarker.getComponent(Transform).position.y = 0.15;

                //determine all possible moves
                this.PlaceActionMarkers(jumped);

                if(CheckerMarkerPool.IsDebugging){ log("selected marker: "+this.selectedMarker.Index() + ", is enhanced: "+this.selectedMarker.Enhanced);}
            }
        }
    }

    //removes marker's selection and places it back onto the board
    public DeselectMarker()
    {
        if(this.selectedMarker != undefined)
        {
            if(CheckerMarkerPool.IsDebugging){ log("deselected marker: " + this.selectedMarker.Index());}

            //default positioning
            this.selectedMarker.getComponent(Transform).position.y = 0.0;
        }

        //remove marker's reference
        this.selectedMarker = undefined;

        //remove any action markers
        this.HideActionMarkers();
    }

    //moves the currently selected marker to the given tile location
    //  we need to recieve both the tile location and the real-world location
    public MoveSelectedMarker(x:number, y:number, position:Vector3)
    {
        //ensure there is a marker selected
        if(this.selectedMarker != undefined)
        {
            if(CheckerMarkerPool.IsDebugging){ log("moving marker: " + this.selectedMarker.Index() 
            + " to x=" + x.toString() + ", y=" + y.toString()
            + "; in-world: " + position.toString());}

            //remove marker from old tile
            if(this.selectedMarker.Assignment[0] != -1)
            {
                this.occupied_dict.removeItem(this.GetTileIndex(this.selectedMarker.Assignment[0], this.selectedMarker.Assignment[1]));
            }

            //move marker to new tile
            this.selectedMarker.getComponent(Transform).position = position;
            this.selectedMarker.Assignment[0] = x;
            this.selectedMarker.Assignment[1] = y;
            this.occupied_dict.add(this.GetTileIndex(x, y), this.selectedMarker);

            //if marker reaches the opposite edge of the map
            if(this.selectedMarker.Assignment[1] == 7 && this.selectedMarker.Team() == 0)
            {
                if(CheckerMarkerPool.IsDebugging){ log("marker has been enhanced");}
                this.selectedMarker.SetEnhancement(true);
            }
            if(this.selectedMarker.Assignment[1] == 0 && this.selectedMarker.Team() == 1)
            {
                if(CheckerMarkerPool.IsDebugging){ log("marker has been enhanced");}
                this.selectedMarker.SetEnhancement(true);
            }

            //deselect this marker
            this.DeselectMarker();
        }
    }

    //moves the recieved marker to the given position
    //  we need to recieve both the tile location and the real-world location
    public MoveMarker(team:number, id:number, x:number, y:number, position:Vector3):CheckerMarker
    {
        if(this.IsTileInbounds(x,y))
        {
            if(CheckerMarkerPool.IsDebugging){ log("moving marker: " + this.GetMarkerIndex(team, id) 
            + " to x=" + x.toString() + ", y=" + y.toString()
            + "; in-world: " + position.toString());}

            //get marker
            var cur_marker:CheckerMarker = this.marker_dict.getItem(this.GetMarkerIndex(team, id));

            //remove marker from old tile
            if(cur_marker.Assignment[0] != -1)
            {
                this.occupied_dict.removeItem(this.GetTileIndex(cur_marker.Assignment[0], cur_marker.Assignment[1]));
            }

            //move marker to new tile
            cur_marker.getComponent(Transform).position = position;
            cur_marker.Assignment[0] = x;
            cur_marker.Assignment[1] = y;
            this.occupied_dict.add(this.GetTileIndex(x, y), cur_marker);

            //return marker
            return cur_marker;
        }
        //return first marker (this will only occur on-serial load and is meant as an error-switch)
        return this.GetMarkerByTeam(0, 0);
    }

    //captures a marker on the given team/index
    public CaptureMarkerByIndex(team:number, index:number)
    {
        if(CheckerMarkerPool.IsDebugging){ log("capturing marker on team " + team.toString() + ", index of " + index.toString());}

        //get marker
        var cur_marker:CheckerMarker = this.marker_dict.getItem(this.GetMarkerIndex(team, index));
        this.CaptureMaker(cur_marker);
    }
    //captures a marker at the given position, removing it from the list of active markers
    public CaptureMarkerByPos(x:number, y:number)
    {
        if(CheckerMarkerPool.IsDebugging){ log("capturing marker on tile x=" + x.toString() + ", y=" + y.toString());}

        //get marker
        var cur_marker:CheckerMarker = this.occupied_dict.getItem(this.GetMarkerIndex(x, y));
        this.CaptureMaker(cur_marker);
    }

    public CaptureMaker(marker:CheckerMarker)
    {

        //remove marker from tile collection
        this.occupied_dict.removeItem(this.GetTileIndex(marker.Assignment[0], marker.Assignment[1]));

        //hide marker
        marker.setParent(null);
        marker.getComponent(Transform).position = new Vector3(0, -1, 0);
    }

    //returns the in-game location for a tile location
    getTilePosition(x:number, y:number)
    {
        return new Vector3
        (
            (x - (this.grid_size_x/2) + 0.5) * (2/this.grid_size_x),
            0,
            (y - (this.grid_size_y/2) + 0.5) * (2/this.grid_size_y)
        );
    }
}

//represents a single marker on the board
@Component("CheckerMarker")
export class CheckerMarker extends Entity 
{
    //team that owns this marker
    private team:number;
    public Team() { return this.team; }
    //this marker's position on team
    private index:number; 
    public Index() { return this.index; }

    //whether this marker is enhanced/crowned
    public Captured:boolean;
    //whether this marker is enhanced/crowned
    public Enhanced:boolean;
    private enhancedObject:Entity;

    //current position on the board for this marker
    public Assignment:number[] = [-1,-1];
    
    //used to initialzie marker, taking in team, index,
    //  and string of object to represent it
    constructor(t:number, ind:number, obj:string)
    {
        //initialize 
        super();
        
        //set identifiers
        this.team = t;
        this.index = ind;
        this.Captured = false;
        this.Enhanced = false;

        //add transform
        this.addComponent(new Transform
        ({
            position: new Vector3(0,0,0),
            scale: new Vector3(0.3,0.3,0.3),
            rotation: new Quaternion().setEuler(0,0,0)
        }));
        //add a shape to entity, providing visibility in the game world
        this.addComponent(new GLTFShape(obj));

        //create 
        this.enhancedObject = new Entity;
        this.enhancedObject.setParent(this);
        //add transform
        this.enhancedObject.addComponent(new Transform
        ({
            position: new Vector3(0,0.2,0),
            scale: new Vector3(1,1,1),
            rotation: new Quaternion().setEuler(0,0,0)
        }));
        //add a shape to entity, providing visibility in the game world
        this.enhancedObject.addComponent(new GLTFShape(obj));
        this.SetEnhancement(false);
    }

    //resets the marker's core attributes
    public Reset()
    {
        //remove modifiers
        this.Captured = false;
        this.SetEnhancement(false);
    }

    //
    public SetEnhancement(state:boolean)
    {
        this.Enhanced = state;
        if(state)
        {
            this.enhancedObject.setParent(this);
            this.enhancedObject.getComponent(Transform).position = new Vector3(0,0.2,0);
        }
        else
        { 
            this.enhancedObject.setParent(null);
            this.enhancedObject.getComponent(Transform).position = new Vector3(0,0,0);
        }
    }
}

//represents a single marker on the board
export class ActionMarker extends Entity 
{
    //true is there is a target
    public HasJumpTarget:boolean = false;
    //current target for jump removal
    public JumpTarget:number[] = [-1,-1];
    //current position on the board for this marker
    public Assignment:number[] = [-1,-1];

    //used to initialzie marker, taking in team, index,
    //  and string of object to represent it
    constructor()
    {
        //initialize 
        super();

        //add display object
        this.addComponent(new BoxShape());
        this.getComponent(BoxShape).withCollisions = false;
        //add transform
        this.addComponent(new Transform
        ({
            position: new Vector3(0,0,0),
            scale: new Vector3(2/8,0.1,2/8),
            rotation: new Quaternion().setEuler(0,0,0)
        }));
    }

    //resets the marker's core attributes
    public Reset()
    {
        //remove from display
        this.setParent(null);
        this.getComponent(Transform).position = new Vector3(0, -1, 0);
        //default jump target
        this.HasJumpTarget = false;
        this.JumpTarget[0] = -1;
        this.JumpTarget[1] = -1;
        //default assignment
        this.Assignment[0] = -1;
        this.Assignment[1] = -1;
    }
}