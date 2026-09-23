<?php
// EKSTRUH contact handler. Fixed recipient, allowlisted subjects, CSRF token,
// honeypot, rate limiting, sanitisation and CRLF protection. Test mode OFF.
define('CONTACT_TEST_MODE', false);
session_start();
$RECIPIENT = 'info@ekstruh.dev';
$SUBJECTS = ['new-project','modernisation','support','staff-augmentation','other'];
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
// CSRF
if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], (string)($_POST['csrf_token'] ?? ''))) { http_response_code(403); exit('Bad token'); }
// Honeypot
if (!empty($_POST['company'])) { http_response_code(200); exit(''); }
// Rate limit: max 3 submissions per 10 minutes per session
$now = time();
$_SESSION['rl'] = array_filter($_SESSION['rl'] ?? [], fn($t) => $now - $t < 600);
if (count($_SESSION['rl']) >= 3) { http_response_code(429); exit('Too many requests'); }
$_SESSION['rl'][] = $now;
// Sanitise + validate
$name = trim(preg_replace('/\s+/', ' ', substr((string)($_POST['name'] ?? ''), 0, 80)));
$email = filter_var((string)($_POST['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$subject = (string)($_POST['subject'] ?? '');
$message = trim(substr((string)($_POST['message'] ?? ''), 0, 4000));
if ($name === '' || !$email || $message === '' || !in_array($subject, $SUBJECTS, true)) { http_response_code(422); exit('Invalid input'); }
// CRLF protection
$clean = fn($v) => str_replace(["\r", "\n"], ' ', $v);
$name = $clean($name); $message = $clean($message);
$label = array_combine($SUBJECTS, ['New project','Application modernisation','Support & maintenance','Staff augmentation','Other'])[$subject];
$body = "Name: $name\nEmail: $email\nSubject: $label\n\n$message\n";
$headers = 'From: website@' . $_SERVER['SERVER_NAME'] . "\r\n"
         . 'Reply-To: website@' . $_SERVER['SERVER_NAME'] . "\r\n"
         . 'X-Contact-Email: ' . $email . "\r\n"
         . 'Content-Type: text/plain; charset=utf-8';
if (CONTACT_TEST_MODE) { http_response_code(200); exit('test'); }
mail($RECIPIENT, 'EKSTRUH enquiry: ' . $label, $body, $headers);
http_response_code(200); exit('sent');
