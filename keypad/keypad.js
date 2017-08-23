/**
 * Copyright 2013,2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var exec = require('child_process').exec;
    var spawn = require('child_process').spawn;
    var fs = require('fs');

    var gpioCommand = __dirname+'/keypad';

    try {
        fs.statSync("/dev/ttyAMA0"); // unlikely if not on a Pi
    } catch(err) {
        //RED.log.info(RED._("rpi-gpio.errors.ignorenode"));
        throw "Info : "+RED._("rpi-gpio.errors.ignorenode");
    }

    try {
        fs.statSync("/usr/share/doc/python-rpi.gpio"); // test on Raspbian
        // /usr/lib/python2.7/dist-packages/RPi/GPIO
    } catch(err) {
        try {
            fs.statSync("/usr/lib/python2.7/site-packages/RPi/GPIO"); // test on Arch
        }
        catch(err) {
            RED.log.warn(RED._("rpi-gpio.errors.libnotfound"));
            throw "Warning : "+RED._("rpi-gpio.errors.libnotfound");
        }
    }

    if ( !(1 & parseInt((fs.statSync(gpioCommand).mode & parseInt("777", 8)).toString(8)[0]) )) {
        RED.log.error(RED._("rpi-gpio.errors.needtobeexecutable",{command:gpioCommand}));
        throw "Error : "+RED._("rpi-gpio.errors.mustbeexecutable");
    }

    // the magic to make python print stuff immediately
    process.env.PYTHONUNBUFFERED = 1;

    var pinsInUse = {};
    var pinTypes = {"out":RED._("rpi-gpio.types.digout"), "tri":RED._("rpi-gpio.types.input"), "up":RED._("rpi-gpio.types.pullup"), "down":RED._("rpi-gpio.types.pulldown"), "pwm":RED._("rpi-gpio.types.pwmout")};

    function KeypadNode(n) {
        RED.nodes.createNode(this,n);
        this.buttonState = -1;
        this.coumn1 = n.column1;
		this.coumn2 = n.column2;
		this.coumn3 = n.column3;
		this.coumn4 = n.column4;
		this.row1 = n.row1;
		this.row2 = n.row2;
		this.row3 = n.row3;
		this.row4 = n.row4;
        this.read = n.read || false;
		this.keypadPins = [this.coumn1, this.coumn2, this.coumn3, this.coumn4, this.row1, this.row2, this.row3, this.row4];
		this.pinError = false;
        if (this.read) { this.buttonState = -2; }
        var node = this;
		var i = 0;
		for (i=0; i<8; i++){
			if (!pinsInUse.hasOwnProperty(this.keypadPins[i])) {
				pinsInUse[this.keypadPins[i]] = this.intype;
			}
			else {
				if ((pinsInUse[this.keypadPins[i]] !== this.intype)||(pinsInUse[this.keypadPins[i]] === "pwm")) {
					node.warn(RED._("rpi-gpio.errors.alreadyset",{pin:this.keypadPins[i],type:pinTypes[pinsInUse[this.keypadPins[i]]]}));
				}
			}
		}

		for (i=0; i<8; i++){
			if (node.keypadPins[i] == undefined) {
				node.pinError = true;
			}
		}
		
        if (node.pinError !== true) {
            node.child = spawn(gpioCommand, ["keypad",node.coumn1,node.coumn2,node.coumn3,node.coumn4,node.row1,node.row2,node.row3,node.row4]);
            node.running = true;
            node.status({fill:"green",shape:"dot",text:"common.status.ok"});

            node.child.stdout.on('data', function (data) {
                data = data.toString().trim();
                if (data.length > 0) {
                    if (node.running && node.buttonState !== -1) {
                        node.send({ topic:"Keypad_Input", payload:(data) });
                    }
                    node.buttonState = data;
                    node.status({fill:"green",shape:"dot",text:data});
                    if (RED.settings.verbose) { node.log("out: "+data+" :"); }
                }
            });

            node.child.stderr.on('data', function (data) {
                if (RED.settings.verbose) { node.log("err: "+data+" :"); }
            });

            node.child.on('close', function (code) {
                node.running = false;
                node.child = null;
                if (RED.settings.verbose) { node.log(RED._("rpi-gpio.status.closed")); }
                if (node.done) {
                    node.status({fill:"grey",shape:"ring",text:"rpi-gpio.status.closed"});
                    node.done();
                }
                else { node.status({fill:"red",shape:"ring",text:"rpi-gpio.status.stopped"}); }
            });

            node.child.on('error', function (err) {
                if (err.errno === "ENOENT") { node.error(RED._("rpi-gpio.errors.commandnotfound")); }
                else if (err.errno === "EACCES") { node.error(RED._("rpi-gpio.errors.commandnotexecutable")); }
                else { node.error(RED._("rpi-gpio.errors.error",{error:err.errno})) }
            });

        }
        else {
            node.warn(RED._("rpi-gpio.errors.invalidpin")+": "+node.pin);
        }

        node.on("close", function(done) {
            node.status({fill:"grey",shape:"ring",text:"rpi-gpio.status.closed"});
            delete pinsInUse[node.pin];
            if (node.child != null) {
                node.done = done;
                node.child.stdin.write("close");
                node.child.kill('SIGKILL');
            }
            else { done(); }
        });
    }
    RED.nodes.registerType("keypad in",KeypadNode);

    var pitype = { type:"" };
    exec(gpioCommand+" info", function(err,stdout,stderr) {
        if (err) {
            RED.log.info(RED._("rpi-gpio.errors.version"));
        }
        else {
            try {
                var info = JSON.parse( stdout.trim().replace(/\'/g,"\"") );
                pitype.type = info["TYPE"];
            }
            catch(e) {
                RED.log.info(RED._("rpi-gpio.errors.sawpitype"),stdout.trim());
            }
        }
    });

    RED.httpAdmin.get('/keypad/:id', RED.auth.needsPermission('keypad.read'), function(req,res) {
        res.json(pitype);
    });

    RED.httpAdmin.get('/rpi-pins/:id', RED.auth.needsPermission('keypad.read'), function(req,res) {
        res.json(pinsInUse);
    });
}
