# Noor API sources

## Duas

Provider: UmmahAPI
Endpoint: `https://ummahapi.com/api/duas`
Purpose: Retrieve the available Dua collection (Arabic, transliteration, English meaning, category and source reference where supplied). The frontend filters the downloaded collection locally for responsive letter-by-letter search.
Provider documentation: https://ummahapi.com/duas-api
Provider documentation states 126 duas, 27 categories, no API key, and a published limit of up to 100 requests/minute. Availability and terms may change; check the provider's current documentation before production use.

## Quran

Provider: AlQuran Cloud
Surah index: `https://api.alquran.cloud/v1/surah`
Selected Surah: `https://api.alquran.cloud/v1/surah/{number}/editions/quran-uthmani,en.sahih`
Purpose: list all 114 Surahs and load the selected Surah in Uthmani Arabic and Saheeh International English meaning.
Documentation: https://alquran.cloud/api

## Review before release

The use of a public API does not by itself grant unrestricted rights to redistribute every translation, audio file, or ancillary asset. Review the provider's current terms, translation permissions, attribution requirements and rate limits before commercial launch. Verify all religious content with qualified scholars.
