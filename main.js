'use strict';

/*
 * Created with @iobroker/create-adapter v1.8.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
const shed = require("./shed");

class ShedInterface extends utils.Adapter {

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'shed',
        });
        this.on('ready', this.onReady);
        this.on('objectChange', this.onObjectChange);
        this.on('stateChange', this.onStateChange);
        // this.on("message", this.onMessage);
        this.on('unload', this.onUnload);

        this.POLL_SEQ = "EcEp";
        this.pollIndex = 0;
        
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
    
        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        let poll_ms = this.config.poll_rate_s*1000 || 4000;
        
        this.log.info(`poll ${poll_ms}`);

        await this.init();

        this.shed = new shed.Shed();
        this.shed.oninfo =  (o) => { this.gotinfo(o); };
        this.shed.oncounters = (o) => { this.gotcounters(o); };
        this.shed.onpersisted = (o) => { this.gotpersisted(o); };
        this.shed.start();
        
        this.timer = setInterval( 
                        () => this.poll(), 
                        poll_ms
                        );
        
        this.log.info("--Init Completed--");
        
        this.subscribeStates("state.relay");
        this.subscribeStates("counter.reset");
        this.subscribeStates("persist.reset");
        
    }

    //--------------------------------------------------------------------
    
    
    poll() {
        let ch = this.POLL_SEQ[this.pollIndex++];
        this.pollIndex &= 3;
        //this.log.info(`Polling ${ch}`);
        this.shed.send(ch);
    }
    
    //--------------------------------------------------------------------
    setValues(dvc, o) {
        for (const [k, v] of Object.entries(o)) { 
            this.setState(dvc + k, { val: v, ack: true });
        }                
    }
    //--------------------------------------------------------------------
    gotinfo(o) {
        
        if(this.lastrelaystate == o.relay){
            delete o.relay;
        } else {
            this.lastrelaystate = o.relay;
        }

        o.lightOn = o.light > 1.0;
        
        this.setValues("state.",o);
    }
    
    //--------------------------------------------------------------------
    gotcounters(o) {
        this.setValues("counter.",o);        
    }    

    
    //--------------------------------------------------------------------
    gotpersisted(o) {
        this.setValues("persist.",o);        
    }
    
    
    //--------------------------------------------------------------------
    /**
     * Make the device/object structure
     */
    async init() {
        try
        {
            var dvc = 'state';
            await this.makeDevice(dvc);
            await this.makeState(dvc+".relay",              "Laser Operational", "boolean", "", true);
            await this.makeState(dvc+".flags",              "State Flags", "boolean", "");
            await this.makeState(dvc+".insideTemp",         "Inside Temp", "number", "C" );
            await this.makeState(dvc+".pressure",           "Pressure", "number", "hPa" );
            await this.makeState(dvc+".humidity",           "Humidity", "number", "%" );
            await this.makeState(dvc+".outsideTemp",        "Outside Temp", "number", "C" );
            await this.makeState(dvc+".light",              "Light Level", "number", "%" );
            await this.makeState(dvc+".lightOn",            "Light On", "boolean", "" );
            await this.makeState(dvc+".laserInletTemp",     "Laser Inlet Temp", "number", "C" );
            await this.makeState(dvc+".laserOutletTemp",    "Laser Outlet Temp", "number", "C" );
            await this.makeState(dvc+".laserTubeTemp",      "Laser Tube Temp", "number", "C" );
            await this.makeState(dvc+".laserCaseTemp",      "Laser Enclosure Temp", "number", "C" );

            dvc = 'counter';
            await this.makeDevice(dvc);
            await this.makeState(dvc+".reset",              "Reset Counters", "boolean", "", true);
            await this.makeState(dvc+".goodpackets",        "Good Packets", "number", "" );
            await this.makeState(dvc+".csumerrs",           "", "number", "" );
            await this.makeState(dvc+".linklost",           "", "number", "" );
            await this.makeState(dvc+".overflows",          "", "number", "" );
            await this.makeState(dvc+".eth_packets",        "", "number", "" );
            await this.makeState(dvc+".relay_operations",   "", "number", "" );
            await this.makeState(dvc+".restarts", "",       "number", "" );
            
            
            dvc = 'persist';
            await this.makeDevice(dvc);
            await this.makeState(dvc+".reset",              "Reset Persist vars", "boolean", "", true);
            await this.makeState(dvc+".restarts",           "", "number", "" );
            await this.makeState(dvc+".exceptions",         "", "number", "" );
            await this.makeState(dvc+".exc_addr",           "", "number", "" );
            await this.makeState(dvc+".exc_type",           "", "number", "" );
            await this.makeState(dvc+".exc_task",           "", "string", "" );
                        
        }
        catch(ex)
        {
            this.log.error(ex);
        }
    }

    //--------------------------------------------------------------------
    /**
     * 
     * @param {string} id 
     * @param {string} name 
     * @param {string} type 
     * @param {string} unit 
     * @param {boolean} wr 
     * @param {string} role 
     */
    async makeState(id, name, type, unit="",  wr=false, role="Value",) {

        //this.log.info(`Making state ${id}` );
        await this.setObjectNotExistsAsync(id, {
            type: "state",
            common: {
                name: name,
                type: type,
                role: role,
                read: true,
                unit: unit,
                write: wr,
            },
            native: {},
        });
    }    
    
    //--------------------------------------------------------------------
    /**
     * @param {string} devicename
     */
    async makeDevice(devicename) {
        //this.log.info(`Making device ${devicename}` );
        
        await this.setObjectNotExistsAsync(devicename, {
            type: "device",
            common: {
                name: devicename,
            },
            native: {},
        });
        //this.log.info("done");
    }
    
    //--------------------------------------------------------------------
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            if(this.timer)
                clearTimeout(this.timer);

            if(this.shed)
                this.shed.stop();
            
            
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    //--------------------------------------------------------------------
    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
                    
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    //--------------------------------------------------------------------
    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            if(!state.ack) {
                if(id.endsWith("relay")) {
                    this.shed.setRelay(state.val);
                } else if(id.endsWith("counter.reset")) {
                    this.shed.resetCounters();
                    this.setState('counter.reset', { val: false, ack: true });
                } else if(id.endsWith("persist.reset")) {
                    this.shed.resetPersisted();
                    this.setState('persist.reset', { val: false, ack: true });
                } else {
                    this.log.warn(`Dont know what to do with state ${id} changed: ${JSON.stringify(obj)}`);
                }
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
    //--------------------------------------------------------------------

}

if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new ShedInterface(options);
} else {
    // otherwise start the instance directly
    new ShedInterface();
}
