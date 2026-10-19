import copy
import json
import unittest
from pathlib import Path
from django.core.exceptions import ValidationError
from projects.validation import document

class LineSceneValidationTests(unittest.TestCase):
    def sample(self):
        v=copy.deepcopy(json.loads((Path(__file__).parent/'fixtures/projects-v2.json').read_text(encoding='utf-8'))[0])
        v['simulation']['scene']='lineTrack'
        s=v['scene'];s['sourceTemplate']='lineTrack';s['canvas'].update(width=960,height=540,background='lineTrack',lineCircuit=dict(width=16,strokes=[[dict(x=100,y=390),dict(x=800,y=390)]]));s['canvas'].pop('itemOrder',None)
        s['devices']=[dict(schemaVersion=1,id='eyes',kind='lineSensors',name='Sensores del suelo',position=dict(x=165,y=420),rotation=0,pins=dict(left=34,center=35,right=36),config=dict(profile='DIGITAL_3',values=dict(left=False,center=False,right=False),settings=dict(activeLow=True)))]
        s['widgets']=[]
        return v
    def test_accepts_and_optional_circuit(self):
        v=self.sample();self.assertGreater(document(v),0);del v['scene']['canvas']['lineCircuit'];self.assertGreater(document(v),0)
    def test_bad_circuits(self):
        for bad in (dict(width=30,strokes=[]),dict(width=16,strokes=[[dict(x=20,y=30),dict(x=50,y=100)]]),dict(width=16,strokes=[],extra=True),dict(width=16,strokes=[[dict(x=100,y=100)]])):
            v=self.sample();v['scene']['canvas']['lineCircuit']=bad
            with self.subTest(bad=bad),self.assertRaises(ValidationError):document(v)
    def test_bad_sensor_settings_or_slot(self):
        for change in ('polarity','position','duplicate'):
            v=self.sample();d=v['scene']['devices'][0]
            if change=='polarity':d['config']['settings']['activeLow']='yes'
            elif change=='position':d['position']['x']=170
            else:
                second=copy.deepcopy(d);second['id']='other';v['scene']['devices'].append(second)
            with self.subTest(change=change),self.assertRaises(ValidationError):document(v)
    def test_legacy_still_accepted(self):
        v=self.sample();v['scene']['devices']=[];self.assertGreater(document(v),0)
