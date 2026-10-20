#pragma once
static bool remote_finishing=false;
static std::atomic<bool> remote_walk_guard{false};
static bool remote_permits(int index){
  if(!remote_enabled.load())return true;
  xSemaphoreTake(remote_mutex,portMAX_DELAY);remote_control.expire((uint32_t)(esp_timer_get_time()/1000));
  bool ok=remote_control.connected&&remote_control.armed&&!remote_control.stopped&&(remote_control.mode?remote_control.mission>0:remote_control.direction==index+1);
  xSemaphoreGive(remote_mutex);return ok;
}
static bool remote_begin(){
  cJSON *dev=remote_device();xSemaphoreTake(remote_mutex,portMAX_DELAY);remote_control=CapiRemote{};remote_session.clear();remote_state="{}";remote_key=remote_nvs("remote_key");remote_enabled=dev!=nullptr;remote_missions=dev?cJSON_GetArraySize(cJSON_GetObjectItem(cJSON_GetObjectItem(cJSON_GetObjectItem(dev,"config"),"remote"),"missions")):0;xSemaphoreGive(remote_mutex);
  remote_finishing=false;remote_walk_guard=false;
  if(!dev)return true;
  if(wifi_started){esp_wifi_stop();wifi_started=false;}
  return remote_key.size()==32&&wifi_connect()&&remote_http_begin();
}
// Called only with gorilla_mutex held. The watchdog does not wait for blocks.
static void remote_guard(uint32_t now){
  if(!remote_enabled.load())return;
  xSemaphoreTake(remote_mutex,portMAX_DELAY);remote_control.expire(now);
  bool stop=remote_control.stopped;
  bool allowed=remote_control.connected&&remote_control.armed&&(remote_control.direction||remote_control.mission);
  xSemaphoreGive(remote_mutex);
  if(stop){gorilla.halt();gorilla_walk.halt();return;}
  if((!allowed||remote_walk_guard.load())&&gorilla.busy&&!remote_finishing){
    gorilla_walk.requested=true;
    if(!gorilla.support(now))gorilla.halt();
    remote_finishing=true;
  }
  if(!gorilla.busy)remote_finishing=false;
}
static void remote_publish(){
  if(!remote_enabled.load())return;
  static uint32_t last=0;uint32_t now=(uint32_t)(esp_timer_get_time()/1000);if((uint32_t)(now-last)<100)return;last=now;
  if(xSemaphoreTake(gorilla_mutex,0)!=pdTRUE)return;
  cJSON *dev=remote_device(),*config=dev?cJSON_GetObjectItem(dev,"config"):nullptr;
  remote_busy=gorilla.busy;remote_turns=cJSON_IsTrue(cJSON_GetObjectItem(cJSON_GetObjectItem(config,"gait"),"turnsVerified"));
  cJSON *out=cJSON_CreateObject();cJSON_AddStringToObject(out,"robot",text(dev,"name","GorillaBot"));
  cJSON *resources=cJSON_GetObjectItem(active,"resources"),*metadata=cJSON_GetObjectItem(active,"metadata");const char *title=text(metadata,"title",text(resources,"name","Proyecto GorillaBot"));cJSON_AddStringToObject(out,"project",strlen(title)<=320?title:"Proyecto GorillaBot");
  cJSON_AddBoolToObject(out,"running",running&&!paused);cJSON_AddBoolToObject(out,"busy",gorilla.busy);cJSON_AddBoolToObject(out,"ready",gorilla.ready);cJSON_AddBoolToObject(out,"error",gorilla.error);cJSON_AddBoolToObject(out,"turns",remote_turns.load());
  bool valid=front_sonar_ready&&front_sonar.fresh((uint32_t)esp_timer_get_time());cJSON_AddBoolToObject(out,"valid",valid);cJSON_AddNumberToObject(out,"distance",valid?front_sonar.distance.load():0);
  const char *outcomes[]={"ninguno","condición","tiempo máximo","solicitado","error"};cJSON_AddStringToObject(out,"outcome",outcomes[gorilla_walk.outcome]);
  cJSON_AddBoolToObject(out,"button",false);
  cJSON *devices=cJSON_GetObjectItem(resources,"devices"),*button;cJSON_ArrayForEach(button,devices)if(!strcmp(text(button,"kind"),"button")&&pin(button,"signal")>=0){int p=pin(button,"signal");gpio_set_direction((gpio_num_t)p,GPIO_MODE_INPUT);gpio_set_pull_mode((gpio_num_t)p,cJSON_IsTrue(cJSON_GetObjectItem(cJSON_GetObjectItem(button,"config"),"pullup"))?GPIO_PULLUP_ONLY:GPIO_FLOATING);cJSON_ReplaceItemInObject(out,"button",cJSON_CreateBool(gpio_get_level((gpio_num_t)p)==0));break;}
  cJSON *ms=cJSON_GetObjectItem(cJSON_GetObjectItem(config,"remote"),"missions");cJSON_AddItemToObject(out,"missions",ms?cJSON_Duplicate(ms,true):cJSON_CreateArray());
  cJSON *angles=cJSON_AddArrayToObject(out,"angles");for(int i=0;i<8;++i)cJSON_AddItemToArray(angles,cJSON_CreateNumber(gorilla.position[i]));
  char *encoded=cJSON_PrintUnformatted(out);cJSON_Delete(out);xSemaphoreGive(gorilla_mutex);
  xSemaphoreTake(remote_mutex,portMAX_DELAY);remote_state=encoded?encoded:"{}";xSemaphoreGive(remote_mutex);free(encoded);
}
static void remote_info(){
  cJSON *out=cJSON_CreateObject();cJSON_AddStringToObject(out,"type","REMOTE_CONFIGURED");std::string ssid=remote_nvs("wifi_ssid"),key=remote_nvs("remote_key");cJSON_AddStringToObject(out,"ssid",ssid.c_str());cJSON_AddStringToObject(out,"key",key.c_str());
  esp_netif_ip_info_t ip={};esp_netif_t *netif=esp_netif_get_handle_from_ifkey(remote_nvs("remote_mode")=="ap"?"WIFI_AP_DEF":"WIFI_STA_DEF");char url[64]={};if(netif&&esp_netif_get_ip_info(netif,&ip)==ESP_OK&&ip.ip.addr)snprintf(url,sizeof(url),"http://" IPSTR "/",IP2STR(&ip.ip));cJSON_AddStringToObject(out,"url",url);send_json(out);
}
static bool remote_provision(cJSON *req){
  const char *mode=text(req,"mode"),*password=text(req,"password");std::string id=hardware_id();
  if(is_waveshare()||id.size()!=12||(strcmp(mode,"ap")&&strcmp(mode,"client"))||strlen(password)<8||strlen(password)>63)return false;
  std::string ssid=!strcmp(mode,"ap")?"Gorilla-"+id.substr(6):text(req,"ssid");
  if(!wifi_provision(ssid.c_str(),password))return false;
  remote_enabled=false;
  nvs_handle_t h;if(nvs_open("capi",NVS_READWRITE,&h)!=ESP_OK)return false;
  esp_err_t result=nvs_set_str(h,"remote_mode",mode);
  for(const char *k:{"pair_role","pair_key","screen_id"})nvs_erase_key(h,k);
  if(result==ESP_OK)result=nvs_commit(h);
  nvs_close(h);
  if(result!=ESP_OK)return false;
  if(wifi_started){esp_wifi_stop();wifi_started=false;}
  remote_configuring=true;bool connected=wifi_connect();remote_configuring=false;
  if(!connected)return false;
  // Wi-Fi is started before drawing credentials from the hardware RNG.
  std::string key=remote_random();if(nvs_open("capi",NVS_READWRITE,&h)!=ESP_OK)return false;
  result=nvs_set_str(h,"remote_key",key.c_str());if(result==ESP_OK)result=nvs_commit(h);
  nvs_close(h);return result==ESP_OK;
}
