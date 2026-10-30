"""Web Serial-compatible test bridge. Explicit --port only; no device discovery/writes outside it."""
import argparse
import base64
import json
import sys
import threading
import serial

parser = argparse.ArgumentParser()
parser.add_argument('--port', required=True)
args = parser.parse_args()
output_lock = threading.Lock()
device = None
reader = None
stop = threading.Event()


def emit(value):
    with output_lock:
        print(json.dumps(value), flush=True)


def read_serial():
    try:
        while not stop.is_set():
            data = device.read(max(1, min(device.in_waiting, 16384)))
            if data:
                emit({'data': base64.b64encode(data).decode('ascii')})
    except Exception:
        if not stop.is_set():
            emit({'lost': True})


def close():
    global device, reader
    stop.set()
    if reader:
        reader.join(timeout=2)
        reader = None
    if device:
        device.close()
        device = None


try:
    for line in sys.stdin:
        request = json.loads(line)
        try:
            op = request['op']
            if op == 'open':
                if device:
                    raise ValueError('already open')
                device = serial.Serial(port=None, baudrate=request['baud'], timeout=0.05, write_timeout=5)
                device.dtr = False
                device.rts = False
                device.port = args.port
                device.open()
                stop.clear()
                reader = threading.Thread(target=read_serial, daemon=True)
                reader.start()
            elif op == 'write':
                data = base64.b64decode(request['data'], validate=True)
                if device.write(data) != len(data):
                    raise ValueError('short write')
            elif op == 'signals':
                if 'dataTerminalReady' in request['value']:
                    device.dtr = request['value']['dataTerminalReady']
                if 'requestToSend' in request['value']:
                    device.rts = request['value']['requestToSend']
            elif op == 'close':
                close()
            else:
                raise ValueError('unknown operation')
            emit({'id': request['id'], 'ok': True})
        except Exception as error:
            emit({'id': request['id'], 'error': type(error).__name__})
finally:
    close()
