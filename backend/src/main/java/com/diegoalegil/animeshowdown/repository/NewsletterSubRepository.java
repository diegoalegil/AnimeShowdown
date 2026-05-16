package com.diegoalegil.animeshowdown.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.diegoalegil.animeshowdown.model.NewsletterSub;

public interface NewsletterSubRepository extends JpaRepository<NewsletterSub, Long> {

    Optional<NewsletterSub> findByEmail(String email);

    Optional<NewsletterSub> findByTokenConfirm(String token);

    Optional<NewsletterSub> findByTokenUnsubscribe(String token);
}
