/** @file

Shed controller UDP poller

 */

udp = require("dgram")

// ES 6
class Shed {

    constructor() {
        this.port = 666;
        this.ip = "192.168.0.20";
        this.ondata = null;
        this.oninfo = null;
        this.oncounters = null;
        this.onpersisted = null;
    }
    
    start()
    {
        if(!this.client) {
            this.client = udp.createSocket("udp4");
            this.client.on("message", (m,i) => this.recv(m,i));
        }
    }
    
    stop()
    {
        if(this.client) {
            this.client.close();
            this.client = null;
        }
    }
    
    /**
     * request latest data
     * @returns {undefined}
     */
    fetchState()
    {
        // console.log(this);
        this.send('E');
    }
    
    /**
     * Request latest counters
     * @returns {undefined}
     */
    fetchCounters()
    {
        this.send('c');
    }
    
    /**
     * Reset the counters
     * @returns {undefined}
     */
    resetCounters()
    {
        this.send('C');
    }
    
    /**
     * Request latest persisted
     * @returns {undefined}
     */
    fetchPersisted()
    {
        this.send('p');
    }
    
    /**
     * reset persisted
     * @returns {undefined}
     */
    resetPersisted()
    {
        this.send('P');
    }
    
    /**
     * Set relay on/off
     * @param {type} state
     * @returns {undefined}
     */
    setRelay(state)
    {
        this.send( state ? 'R' : 'r');
    }
    
    send(cmd)    
    {
        var b = Buffer.allocUnsafe(2);
        b.writeUInt8(2,0)
        b.writeUInt8(cmd.charCodeAt(0),1);
        this.client.send(b, 0, b.length, this.port, this.ip, (err,bytes) => {
            if(err) throw err;
            console.log("Tx UDP");
        });
    }
    
    /**
     * Called when a UDP packet arrives.
     * Decodes the type, then fires the object's callabck(s)
     * as appropriate.
     * 
     * @param {type} msg
     * @param {type} rinfo
     * @returns {undefined}
     */
    recv(msg,rinfo)
    {
        console.log("Rx UDP");
        //console.log(rinfo);
        //console.log(msg);
        if(msg.length<0) {
            console.log("Packet is zero size!");
            return;
        }
        var len = msg.readUInt8(0);
        var cmd = String.fromCharCode(msg.readUInt8(1));
        switch(cmd)
        {
            // Normal info packet
            case 'E':
                if(msg.length<40) {
                    console.log("E Packet is too small!");
                    return;
                }
                let flags = msg.readUInt16LE(2);
                var rx = {
                    kind : cmd,
                    flags : flags,
                    relay : (flags & 1) ==1,
                    insideTemp : msg.readFloatLE(4),
                    pressure : msg.readFloatLE(8),
                    humidity : msg.readFloatLE(12),
                    outsideTemp : msg.readFloatLE(16),
                    light : msg.readFloatLE(20),
                    laserInletTemp : msg.readFloatLE(24),
                    laserOutletTemp : msg.readFloatLE(28),
                    laserTubeTemp : msg.readFloatLE(32),
                    laserCaseTemp : msg.readFloatLE(36)
                    };
                    
                if(this.oninfo)
                    this.oninfo(rx);
                
                break;
                
            // Counters
            case 'C':
            case 'c':
                if(msg.length<34) {
                    console.log("C Packet is too small!");
                    return;
                }
                var rx = {
                    kind: cmd,
                    goodpackets: msg.readUInt32LE(2),
                    junk: msg.readUInt32LE(6),
                    csumerrs: msg.readUInt32LE(10),
                    linklost: msg.readUInt32LE(14),
                    overflows: msg.readUInt32LE(18),
                    eth_packets: msg.readUInt32LE(22),
                    relay_operations: msg.readUInt32LE(26),
                    restarts: msg.readUInt32LE(30)                    
                };

                if(this.oncounters)
                    this.oncounters(rx);

                break;
                
            // Persisted
            case 'P':
            case 'p':
                if(msg.length<24) {
                    console.log("P Packet is too small!");
                    return;
                }
                var task = msg.toString("ascii",15,23);
                var ni = task.indexOf("\0");
                if(ni>=0)
                    task = task.slice(0,ni);
                
                var rx = {
                    kind: cmd,
                    restarts: msg.readUInt32LE(2),
                    exceptions: msg.readUInt32LE(6),
                    exc_addr: msg.readUInt32LE(10),
                    exc_type: msg.readUInt8(14),
                    exc_task: task
                };
                
                if(this.onpersisted)
                    this.onpersisted(rx);
                
                break;
                
            default:
                console.log("Unexpected Rx Packet type [${cmd}]");
                break;
        }
        //console.log(this);
        if(this.ondata) {
            this.ondata(rx);
            //console.log(rx);
        }
        
    }
}

exports.Shed = Shed;


