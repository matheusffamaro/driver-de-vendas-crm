<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role_id' => 'nullable|uuid|exists:roles,id',
            'phone' => 'nullable|string|max:20',
        ];
    }

    /**
     * Get validated data, excluding protected fields.
     */
    public function validatedSafe(): array
    {
        $data = $this->validated();
        
        // Remove any protected fields that might have been injected
        unset($data['is_super_admin']);
        unset($data['tenant_id']);
        unset($data['is_active']);
        unset($data['suspended_at']);
        unset($data['suspended_reason']);
        
        return $data;
    }
}
