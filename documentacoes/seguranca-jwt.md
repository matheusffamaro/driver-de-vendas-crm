# JWT Secret Security

## ⚠️ IMPORTANTE - Secret Atualizado

O JWT secret foi atualizado para um valor forte e seguro em **12/02/2026**.

## 🔒 Geração de Secret Forte

Para gerar um novo JWT secret forte, use:

```bash
openssl rand -base64 64
```

## 📋 Ações Realizadas

1. ✅ Gerado novo secret forte com 64 bytes (512 bits)
2. ✅ Atualizado `.env` com o novo secret
3. ✅ Removidos backups de `.env` com secrets expostos
4. ✅ Atualizado `.env.example` com instruções

## 🚨 Impacto da Mudança

### Tokens Existentes

**TODOS os tokens JWT existentes foram invalidados**. Os usuários precisarão:

1. Fazer logout automático (tokens não serão mais válidos)
2. Fazer login novamente para obter novos tokens

### Como Notificar Usuários

1. **Desenvolvimento**: Apenas faça logout e login novamente
2. **Produção**: Envie um aviso prévio aos usuários sobre a necessidade de novo login

## 🔐 Boas Práticas de Segurança

### Nunca Commite o Secret

O arquivo `.env` está no `.gitignore`. **NUNCA** commite:
- `.env`
- `.env.bak`
- `.env.backup.*`
- Qualquer arquivo contendo o JWT_SECRET real

### Rotação de Secrets

Recomendações:
- **Produção**: Rotacionar a cada 90-180 dias
- **Suspeita de comprometimento**: Imediatamente
- **Após incidente de segurança**: Imediatamente

### Diferentes Secrets por Ambiente

Use secrets diferentes para:
- ✅ Desenvolvimento (local)
- ✅ Staging/Homologação
- ✅ Produção

### Verificação de Força

O secret atual tem:
- ✅ 88 caracteres
- ✅ Base64 encoding
- ✅ Alta entropia (gerado com openssl)
- ✅ Não previsível

## 📝 Checklist de Deploy

Ao fazer deploy com novo secret:

- [ ] Atualizar variável de ambiente no servidor
- [ ] Reiniciar aplicação
- [ ] Verificar logs para erros de autenticação
- [ ] Notificar usuários sobre necessidade de novo login
- [ ] Monitorar métricas de login nas primeiras horas

## 🆘 Em Caso de Comprometimento

Se o JWT_SECRET for comprometido:

1. **Gerar novo secret imediatamente**:
   ```bash
   openssl rand -base64 64
   ```

2. **Atualizar em todos os ambientes**

3. **Invalidar todos os tokens** (automático ao trocar secret)

4. **Investigar como o secret foi exposto**

5. **Implementar medidas preventivas**

## 📞 Contato

Em caso de dúvidas sobre segurança JWT, consulte a documentação oficial do Laravel ou entre em contato com a equipe de segurança.

---

**Última atualização**: 12/02/2026  
**Próxima rotação recomendada**: 12/05/2026
