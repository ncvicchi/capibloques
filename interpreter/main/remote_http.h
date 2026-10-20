#pragma once
// Included after runtime helpers: HTTP never accesses the mutable rules tree.
#include "esp_http_server.h"
#include "esp_random.h"
#include "remote_core.h"
#include "remote_panel.h"
static CapiRemote remote_control;
static SemaphoreHandle_t remote_mutex=nullptr,remote_motion_mutex=nullptr;
inline bool remote_motion_busy();
static httpd_handle_t remote_server=nullptr;
static std::string remote_session,remote_key,remote_state="{}";
static std::atomic<bool> remote_enabled{false},remote_busy{false},remote_turns{false};
static int remote_missions=0;
static uint32_t remote_nonce(){return (esp_random()&0x7ffffffeU)+1U;}
static std::string remote_random(){char result[33];for(int i=0;i<4;++i)snprintf(result+i*8,9,"%08lx",(unsigned long)esp_random());return result;}
static bool remote_same_origin(httpd_req_t *req){
  char origin[128]={},host[96]={};
  if(httpd_req_get_hdr_value_str(req,"Host",host,sizeof(host))!=ESP_OK)return false;
  if(httpd_req_get_hdr_value_len(req,"Origin")==0)return true;
  if(httpd_req_get_hdr_value_str(req,"Origin",origin,sizeof(origin))!=ESP_OK)return false;
  return std::string(origin)==std::string("http://")+host;
}
static void remote_headers(httpd_req_t *req){httpd_resp_set_hdr(req,"Cache-Control","no-store");httpd_resp_set_hdr(req,"X-Content-Type-Options","nosniff");httpd_resp_set_hdr(req,"Referrer-Policy","no-referrer");httpd_resp_set_hdr(req,"Content-Security-Policy","default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");}
static esp_err_t remote_page(httpd_req_t *req){remote_headers(req);httpd_resp_set_type(req,"text/html; charset=utf-8");return httpd_resp_send(req,CAPI_REMOTE_PANEL,HTTPD_RESP_USE_STRLEN);}
static esp_err_t remote_request(httpd_req_t *req){
  remote_headers(req);httpd_resp_set_type(req,"application/json");
  if(!remote_enabled.load()||!remote_same_origin(req)){httpd_resp_set_status(req,"403 Forbidden");return httpd_resp_sendstr(req,"{\"error\":\"Panel no disponible\"}");}
  if(req->content_len<=0||req->content_len>512){httpd_resp_set_status(req,"400 Bad Request");return httpd_resp_sendstr(req,"{\"error\":\"Solicitud inválida\"}");}
  char body[513]={};int got=0;
  while(got<req->content_len){int n=httpd_req_recv(req,body+got,req->content_len-got);if(n<=0)return ESP_FAIL;got+=n;}
  cJSON *request=cJSON_ParseWithLength(body,got);
  if(!cJSON_IsObject(request)){cJSON_Delete(request);httpd_resp_set_status(req,"400 Bad Request");return httpd_resp_sendstr(req,"{}");}
  xSemaphoreTake(remote_motion_mutex,portMAX_DELAY);xSemaphoreTake(remote_mutex,portMAX_DELAY);
  const uint32_t now=(uint32_t)(esp_timer_get_time()/1000);remote_control.expire(now);
  bool accepted=false;
  if(remote_enabled.load()&&remote_key.size()==32&&remote_key==text(request,"key")){
    if(!strcmp(text(request,"type"),"claim")){
      accepted=remote_control.claim(now,remote_nonce());if(accepted)remote_session=remote_random();
    }else if(!strcmp(text(request,"session"),remote_session.c_str())&&!remote_session.empty()){
      bool numbers=true;for(const char *k:{"sequence","ticket","direction","rhythm","mode","mission"}){cJSON *v=cJSON_GetObjectItem(request,k);if(!cJSON_IsNumber(v)||!std::isfinite(v->valuedouble)||v->valuedouble!=v->valueint||v->valueint<0)numbers=false;}
      if(numbers&&cJSON_IsBool(cJSON_GetObjectItem(request,"arm"))&&cJSON_IsBool(cJSON_GetObjectItem(request,"stop")))accepted=remote_control.accept(number(request,"sequence"),number(request,"ticket"),number(request,"direction"),number(request,"rhythm"),number(request,"mode"),number(request,"mission"),cJSON_IsTrue(cJSON_GetObjectItem(request,"arm")),cJSON_IsTrue(cJSON_GetObjectItem(request,"stop")),now,remote_nonce(),remote_motion_busy(),remote_turns.load(),remote_missions);
    }
  }
  cJSON *out=accepted?cJSON_Parse(remote_state.c_str()):cJSON_CreateObject();if(!out)out=cJSON_CreateObject();
  if(accepted){cJSON_AddStringToObject(out,"session",remote_session.c_str());cJSON_AddNumberToObject(out,"sequence",remote_control.sequence);cJSON_AddNumberToObject(out,"ticket",remote_control.ticket);cJSON_AddBoolToObject(out,"armed",remote_control.armed);cJSON_AddBoolToObject(out,"stopped",remote_control.stopped);}
  else{httpd_resp_set_status(req,"409 Conflict");cJSON_AddStringToObject(out,"error","Mando ocupado, clave incorrecta u orden vencida. Soltá y reconectá.");}
  char *encoded=cJSON_PrintUnformatted(out);xSemaphoreGive(remote_mutex);xSemaphoreGive(remote_motion_mutex);cJSON_Delete(request);cJSON_Delete(out);
  esp_err_t result=httpd_resp_sendstr(req,encoded?encoded:"{}");free(encoded);return result;
}
static bool remote_http_begin(){
  if(remote_server)return true;
  httpd_config_t config=HTTPD_DEFAULT_CONFIG();config.stack_size=6144;config.max_open_sockets=3;config.lru_purge_enable=true;config.recv_wait_timeout=1;config.send_wait_timeout=1;
  if(httpd_start(&remote_server,&config)!=ESP_OK)return false;
  httpd_uri_t page={};page.uri="/";page.method=HTTP_GET;page.handler=remote_page;
  httpd_uri_t control={};control.uri="/control";control.method=HTTP_POST;control.handler=remote_request;
  if(httpd_register_uri_handler(remote_server,&page)==ESP_OK&&httpd_register_uri_handler(remote_server,&control)==ESP_OK)return true;
  httpd_stop(remote_server);remote_server=nullptr;return false;
}
