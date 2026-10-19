import copy,json,unittest
from pathlib import Path
from django.core.exceptions import ValidationError
from projects.validation import document

class GorillaValidationTests(unittest.TestCase):
    def sample(self):
        v=copy.deepcopy(json.loads((Path(__file__).parent/'fixtures/projects-v2.json').read_text(encoding='utf-8'))[0]);v['simulation']['scene']='gorillaBench';s=v['scene'];s['sourceTemplate']='gorillaBench';s['canvas'].update(width=960,height=540,background='gorillaBench');s['canvas'].pop('itemOrder',None)
        settings=dict(address=64,verified=False)
        for i in range(8):settings.update({f'channel{i}':i,f'center{i}':90,f'min{i}':70,f'max{i}':110,f'reversed{i}':False})
        values={**{f'j{i}':0 for i in range(8)},'ready':False,'moving':False,'error':False}
        s['devices']=[dict(schemaVersion=1,id='gorilla-robot',kind='gorilla',name='Mi GorillaBot',position=dict(x=480,y=290),rotation=0,pins=dict(sda=18,scl=19),config=dict(profile='GORILLA_PCA9685',values=values,settings=settings))];s['widgets']=[]
        return v
    def test_accepts_profile(self):self.assertGreater(document(self.sample()),0)
    def test_rejects_bad_calibration(self):
        for key,value in [('channel1',0),('channel2',16),('center0',200),('min0',95),('max0',80),('reversed0',1),('verified',1),('address',True),('extra',1)]:
            v=self.sample();v['scene']['devices'][0]['config']['settings'][key]=value
            with self.assertRaises(ValidationError):document(v)
    def test_rejects_fake_runtime_and_duplicate(self):
        v=self.sample();v['scene']['devices'][0]['config']['values']['ready']=True
        with self.assertRaises(ValidationError):document(v)
        v=self.sample();other=copy.deepcopy(v['scene']['devices'][0]);other.update(id='second-gorilla',name='Otro GorillaBot');v['scene']['devices'].append(other)
        with self.assertRaises(ValidationError):document(v)

    def test_postures_and_legacy(self):
        v=self.sample();config=v['scene']['devices'][0]['config']
        config['postures']=[dict(id='ref',name='Referencia',angles=[0]*8)]
        self.assertGreater(document(v),0)
        for bad in ([dict(id='ref',name='Referencia',angles=[0]*7)], [dict(id='ref',name='Referencia',angles=[True]*8)], [dict(id='ref',name='',angles=[0]*8)], config['postures']*2):
            other=copy.deepcopy(v);other['scene']['devices'][0]['config']['postures']=bad
            with self.assertRaises(ValidationError):document(other)
        config['settings']['min7']=85
        config['postures'][0]['angles'][7]=-10
        with self.assertRaises(ValidationError):document(v)
