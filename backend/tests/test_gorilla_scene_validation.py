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
    def test_remote_config_and_derived_values(self):
        v=self.sample();c=v['scene']['devices'][0]['config'];c['remote']={'missions':['Explorar']}
        self.assertGreater(document(v),0)
        for bad in ({'missions':['a','a']},{'missions':[' a']},{'missions':[False]},{'missions':[], 'password':'not-portable'},{'missions':['x'*33]}, {'missions':['a','b','c','d','e']}):
            w=copy.deepcopy(v);w['scene']['devices'][0]['config']['remote']=bad
            with self.assertRaises(ValidationError):document(w)
        c['values']['remoteArmed']=True
        with self.assertRaises(ValidationError):document(v)
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

    def test_v3_trajectories(self):
        v=self.sample();config=v['scene']['devices'][0]['config']
        config['kinematics']=dict(profile='gorilla-v3-50-100-46',zeroAngles=[90]*8,pulseMinUs=1000,pulseMaxUs=2000,verified=False)
        config['trajectories']=[dict(id='lift',name='Levantar',leg=0,points=[dict(forward=0,up=0,ms=1000),dict(forward=0,up=4,ms=1000),dict(forward=0,up=0,ms=1000)])]
        self.assertGreater(document(v),0)
        bads=[]
        w=copy.deepcopy(v);w['scene']['devices'][0]['config']['trajectories'][0]['points'][1]['forward']=50;bads.append(w)
        w=copy.deepcopy(v);w['scene']['devices'][0]['config']['kinematics']['zeroAngles']=[90];bads.append(w)
        w=copy.deepcopy(v);w['scene']['devices'][0]['config']['kinematics']['pulseMaxUs']=2600;bads.append(w)
        w=copy.deepcopy(v);w['scene']['devices'][0]['config']['trajectories']*=2;bads.append(w)
        for bad in bads:
            with self.assertRaises(ValidationError):document(bad)

    def test_gait_and_track(self):
        v=self.sample();v['simulation']['scene']='gorillaTrack';scene=v['scene'];scene['sourceTemplate']='gorillaTrack';scene['canvas'].update(background='gorillaTrack',gorillaTrack='straight',arenaEnvironment=dict(guides=True,obstacles=[]))
        scene['devices'][0]['position']=dict(x=120,y=355)
        scene['devices'][0]['config']['gait']=dict(stride=4,height=2,phaseMs=500,turnsVerified=False)
        self.assertGreater(document(v),0)
        for key,value in [('stride',True),('stride',13),('height',0),('phaseMs',199),('turnsVerified',1),('extra',0)]:
            w=copy.deepcopy(v);w['scene']['devices'][0]['config']['gait'][key]=value
            with self.assertRaises(ValidationError):document(w)
        for key,value in [('gorillaTrack','other'),('width',800)]:
            w=copy.deepcopy(v);w['scene']['canvas'][key]=value
            with self.assertRaises(ValidationError):document(w)
        w=copy.deepcopy(v);w['scene']['devices'][0]['position']['x']=20
        with self.assertRaises(ValidationError):document(w)
        w=copy.deepcopy(v);w['scene']['devices'][0]['position']['x']=230;w['scene']['canvas']['arenaEnvironment']['obstacles']=[dict(x=230,y=355,radius=28)]
        with self.assertRaises(ValidationError):document(w)

    def test_autonomy_workspace_and_derived_values(self):
        v=self.sample();scene=v['scene']
        scene['devices'].append(dict(schemaVersion=1,id='gorilla-sonar',kind='distanceSensor',name='Distancia frontal',position=dict(x=165,y=190),rotation=0,pins=dict(trigger=17,echo=34),config=dict(profile='HC-SR04',values=dict(distance=30),settings=dict(maxDistance=400))))
        scene['devices'].append(dict(schemaVersion=1,id='gorilla-button',kind='button',name='Botón de misión',position=dict(x=800,y=420),rotation=0,pins=dict(signal=4),config=dict(pressed=False,pullup=True)))
        v['workspace']={'blocks':{'languageVersion':0,'blocks':[{'type':'capi_start','id':'start-main','inputs':{'DO':{'block':{'type':'capi_gorilla_walk','id':'walk','fields':{'DEVICE_ID':'gorilla-robot','MODE':'0','LIMIT':30},'inputs':{'CONDITION':{'block':{'type':'capi_component_boolean','id':'valid','fields':{'DEVICE_ID':'gorilla-sonar','PROPERTY':'valid'}}}},'next':{'block':{'type':'capi_gorilla_finish','id':'finish','fields':{'DEVICE_ID':'gorilla-robot'}}}}}}}]}}
        self.assertGreater(document(v),0)
        invalid=copy.deepcopy(v);invalid['scene']['devices'][1]['config']['values']['valid']=True
        with self.assertRaises(ValidationError):document(invalid)
