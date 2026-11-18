package com.myday;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MydayApplication {
    public static void main(String[] args) {
        SpringApplication.run(MydayApplication.class, args);
    }
}
