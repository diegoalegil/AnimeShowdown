package com.diegoalegil.animeshowdown.config;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "cors.allowed-origins=http://localhost:4173")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityCorsTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void preflightDeVotoPermiteCaptchaToken() throws Exception {
        mvc.perform(options("/api/enfrentamientos/1/votar")
                .header(HttpHeaders.ORIGIN, "http://localhost:4173")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS,
                        "X-AS-Captcha-Token,X-AS-Anonymous-Id,Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS,
                        containsString("X-AS-Captcha-Token")));
    }
}
