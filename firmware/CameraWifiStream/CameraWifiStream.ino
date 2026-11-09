/*
 * ULTRON-SAT optional AI Thinker ESP32-CAM live local video.
 * Alternative to CameraNode UART-photo firmware. NOT for MainLogger board.
 * Local private HTTP only: no TLS/auth. Never expose to the Internet.
 *
 * Locally create camera_wifi_secrets.h beside this sketch:
 *   #define CAMERA_WIFI_SSID "YOUR_PRIVATE_2_4GHZ_WIFI"
 *   #define CAMERA_WIFI_PASSWORD "YOUR_PASSWORD"
 * Never commit the secrets header.
 */
#include <Arduino.h>
#include <WiFi.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "camera_wifi_secrets.h"
#if !defined(CAMERA_WIFI_SSID) || !defined(CAMERA_WIFI_PASSWORD)
#error "Define CAMERA_WIFI_SSID and CAMERA_WIFI_PASSWORD locally."
#endif

static httpd_handle_t server=nullptr;
static httpd_handle_t streamServer=nullptr; // separate HTTP handler for continuous MJPEG
static bool cameraOK=false;
static const char *BOUNDARY="ultronframe";
static esp_err_t snapshot(httpd_req_t *req) {
 camera_fb_t *fb=esp_camera_fb_get();
 if(!fb)return httpd_resp_send_500(req);
 httpd_resp_set_type(req,"image/jpeg");
 httpd_resp_set_hdr(req,"Cache-Control","no-store");
 esp_err_t r=httpd_resp_send(req,reinterpret_cast<const char*>(fb->buf),fb->len);
 esp_camera_fb_return(fb);
 return r;
}
static esp_err_t health(httpd_req_t *req) {
 httpd_resp_set_type(req,"application/json");
 httpd_resp_set_hdr(req,"Cache-Control","no-store");
 return httpd_resp_sendstr(req,cameraOK?"{\"camera\":\"ready\",\"mode\":\"local-http\"}":"{\"camera\":\"failed\"}");
}
static esp_err_t stream(httpd_req_t *req) {
 httpd_resp_set_type(req,"multipart/x-mixed-replace;boundary=ultronframe");
 httpd_resp_set_hdr(req,"Cache-Control","no-store");
 esp_err_t r=ESP_OK;
 while(WiFi.status()==WL_CONNECTED&&r==ESP_OK) {
  camera_fb_t *fb=esp_camera_fb_get();
  if(!fb){r=ESP_FAIL;break;}
  char head[100];
  int len=snprintf(head,sizeof(head),"\r\n--%s\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",BOUNDARY,static_cast<unsigned>(fb->len));
  if(len<=0||len>=static_cast<int>(sizeof(head)))r=ESP_FAIL;
  if(r==ESP_OK)r=httpd_resp_send_chunk(req,head,len);
  if(r==ESP_OK)r=httpd_resp_send_chunk(req,reinterpret_cast<const char*>(fb->buf),fb->len);
  esp_camera_fb_return(fb);
  if(r==ESP_OK)r=httpd_resp_send_chunk(req,"\r\n",2);
  vTaskDelay(pdMS_TO_TICKS(25));
 }
 httpd_resp_send_chunk(req,nullptr,0);
 return r;
}
static void startServer(){
 httpd_config_t cfg=HTTPD_DEFAULT_CONFIG();cfg.server_port=80;cfg.max_uri_handlers=4;cfg.stack_size=8192;
 if(httpd_start(&server,&cfg)!=ESP_OK){Serial.println("CAM: server failed");return;}
 httpd_uri_t still={};still.uri="/capture";still.method=HTTP_GET;still.handler=snapshot;
 httpd_uri_t probe={};probe.uri="/health";probe.method=HTTP_GET;probe.handler=health;
 httpd_register_uri_handler(server,&still);
 httpd_register_uri_handler(server,&probe);
 // Keep long-lived streaming requests off the snapshot server task.
 httpd_config_t motionCfg=HTTPD_DEFAULT_CONFIG();
 motionCfg.server_port=81;
 motionCfg.ctrl_port=cfg.ctrl_port+1;
 motionCfg.max_uri_handlers=2;
 motionCfg.stack_size=8192;
 if(httpd_start(&streamServer,&motionCfg)!=ESP_OK){
   Serial.println("CAM: video stream server failed (snapshot may still work)");
   return;
 }
 httpd_uri_t motion={};motion.uri="/stream";motion.method=HTTP_GET;motion.handler=stream;
 httpd_register_uri_handler(streamServer,&motion);
}
void setup(){
 Serial.begin(115200);Serial.setDebugOutput(false);
 camera_config_t c={};
 c.ledc_channel=LEDC_CHANNEL_0;c.ledc_timer=LEDC_TIMER_0;
 c.pin_d0=5;c.pin_d1=18;c.pin_d2=19;c.pin_d3=21;
 c.pin_d4=36;c.pin_d5=39;c.pin_d6=34;c.pin_d7=35;
 c.pin_xclk=0;c.pin_pclk=22;c.pin_vsync=25;c.pin_href=23;
 c.pin_sccb_sda=26;c.pin_sccb_scl=27;c.pin_pwdn=32;c.pin_reset=-1;
 c.xclk_freq_hz=20000000;c.pixel_format=PIXFORMAT_JPEG;
 bool ram=psramFound();
 c.frame_size=FRAMESIZE_QVGA;c.jpeg_quality=ram?12:18;
 c.fb_count=ram?2:1;
 c.fb_location=ram?CAMERA_FB_IN_PSRAM:CAMERA_FB_IN_DRAM;
 c.grab_mode=ram?CAMERA_GRAB_LATEST:CAMERA_GRAB_WHEN_EMPTY;
 if(esp_camera_init(&c)!=ESP_OK){Serial.println("CAM: sensor init failed");return;}
 cameraOK=true;
 WiFi.mode(WIFI_STA);WiFi.setSleep(false);WiFi.begin(CAMERA_WIFI_SSID,CAMERA_WIFI_PASSWORD);
 uint32_t started=millis();
 while(WiFi.status()!=WL_CONNECTED&&millis()-started<20000)delay(300);
 if(WiFi.status()!=WL_CONNECTED){Serial.println("CAM: Wi-Fi unavailable");return;}
 startServer();
 Serial.print("CAM: local video http://");Serial.print(WiFi.localIP());Serial.println(":81/stream");
 Serial.print("CAM: capture now http://");Serial.print(WiFi.localIP());Serial.println("/capture");
}
void loop(){delay(1000);}
