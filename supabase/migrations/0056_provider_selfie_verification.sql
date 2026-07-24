-- Adiciona a selfie segurando o documento como um tipo de verificacao,
-- reforcando que quem enviou o documento e quem esta pedindo cadastro
-- sao a mesma pessoa.
alter table public.provider_verification_documents drop constraint if exists provider_verification_documents_document_type_check;
alter table public.provider_verification_documents add constraint provider_verification_documents_document_type_check
  check (document_type in ('identidade', 'comprovante_endereco', 'selfie', 'certificado', 'outro'));

notify pgrst, 'reload schema';
