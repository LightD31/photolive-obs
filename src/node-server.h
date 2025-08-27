#pragma once

#include <string>
#include <thread>
#include <atomic>

class NodeServerManager {
public:
    NodeServerManager();
    ~NodeServerManager();
    
    bool start();
    void stop();
    bool is_running() const { return running_; }
    
    std::string get_slideshow_url() const;
    std::string get_control_url() const;
    int get_port() const { return port_; }
    
private:
    void run_server();
    bool setup_web_app();
    std::string get_web_app_path();
    std::string get_node_executable();
    
    std::atomic<bool> running_;
    std::thread server_thread_;
    int port_;
    std::string web_app_path_;
    
#ifdef _WIN32
    void* process_handle_;
    void* thread_handle_;
#else
    pid_t process_id_;
#endif
};