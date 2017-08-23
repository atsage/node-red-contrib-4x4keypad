#!/usr/bin/env python2.7

# Topic: Push pin Input - Falling Edge Detection
#
# file : delaypin-v4.py

import RPi.GPIO as GPIO
import struct
import sys
import time
import datetime
import sys, getopt
GPIO.setmode(GPIO.BOARD)

delay_seconds = 2

if sys.version_info >= (3,0):
    print("Sorry - currently only configured to work with python 2.x")
    sys.exit(1)

if len(sys.argv) > 2:
    cmd = sys.argv[1].lower()
    pin = int(sys.argv[2])
    GPIO.setmode(GPIO.BOARD)
    GPIO.setwarnings(False)
    
    keyMatrix = [[1, 2, 3, 'A'],
                [4, 5, 6, 'B'],
                [7, 8, 9, 'C'],
                ['*', 0, '#', 'D']]

    row = [int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])]
    column = [int(sys.argv[6]), int(sys.argv[7]), int(sys.argv[8]), int(sys.argv[9])]

    if cmd == "keypad":
        delay_seconds = float(sys.argv[5]) - 0.35
        def my_callback(chan):
            for k in range(4):
                GPIO.output(column[k], 1)
            for i in range(4):
                GPIO.output(column[i], 0)
                for j in range(4):
                    if GPIO.input(row[j]) == 0:
                        print keyMatrix[i][j]
                        while(GPIO.input(row[j]) == 0):
                            pass
                        
                GPIO.output(column[i],1)
            time.sleep(0.25)
            for k in range(4):
                GPIO.output(column[k], 0)
            
        for i in range(4):
            GPIO.setup(column[i], GPIO.OUT)
            GPIO.output(column[i], 0)

        for j in range(4):
            GPIO.setup(row[j], GPIO.IN, pull_up_down = GPIO.PUD_UP)

        for k in range(4):
            GPIO.add_event_detect(row[k], GPIO.FALLING, callback=my_callback)
        
        print 0
        
        while True:
            try:
                data = raw_input()
                if 'close' in data:
                    sys.exit(0)
            except (EOFError, SystemExit):        # hopefully always caused by us sigint'ing the program
                for i in range(4):
                    GPIO.cleanup(row[i])
                for j in range(4):
                    GPIO.cleanup(column[j])
                sys.exit(0)

elif len(sys.argv) > 1:
    cmd = sys.argv[1].lower()
    if cmd == "rev":
        print GPIO.RPI_REVISION
    elif cmd == "ver":
        print GPIO.VERSION
    elif cmd == "info":
        print GPIO.RPI_INFO
    else:
        print "Bad parameters - in|out|pwm|buzz|byte|borg|mouse|kbd|ver|info {pin} {value|up|down}"
        print "  only ver (gpio version) and info (board information) accept no pin parameter."

else:
    print "Bad parameters - in|out|pwm|buzz|byte|borg|mouse|kbd|ver|info {pin} {value|up|down}"