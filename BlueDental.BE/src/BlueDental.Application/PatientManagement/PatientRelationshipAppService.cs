using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.PatientManagement;

/// <summary>
/// "Mối quan hệ" (function list 4.8). BlueDental-local; see
/// docs/clone/pages/patient-relations.md. Both records must be of the
/// caller's branch, like every patient read.
/// </summary>
[Authorize]
public class PatientRelationshipAppService(
    IRepository<PatientRelationship, Guid> repository,
    IRepository<Patient, Guid> patientRepository,
    PatientFamilyResolver family,
    ICurrentClinicBranchResolver branchResolver) : ApplicationService, IPatientRelationshipAppService
{
    [Authorize(BlueDentalAbilityPermissions.Patient.Read)]
    public async Task<ListResultDto<PatientRelationDto>> GetListAsync(Guid patientId)
    {
        await GetPatientAsync(patientId);
        return new ListResultDto<PatientRelationDto>(await MapAsync(await family.LinksOfAsync(patientId)));
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Read)]
    public async Task<ListResultDto<PatientRelationDto>> GetFamilyAsync(Guid patientId)
    {
        await GetPatientAsync(patientId);
        var links = (await family.LinksOfAsync(patientId)).Where(l => l.IsFamily).ToList();
        return new ListResultDto<PatientRelationDto>(await MapAsync(links));
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Update)]
    public async Task<PatientRelationDto> CreateAsync(CreatePatientRelationDto input)
    {
        var patient = await GetPatientAsync(input.PatientId);
        await GetPatientAsync(input.RelatedPatientId);

        var relationship = await family.RelateAsync(patient.BranchId, input.PatientId, input.RelatedPatientId, input.Type, input.Note);
        return await MapOneAsync(relationship, input.PatientId);
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Update)]
    public async Task<PatientRelationDto> UpdateAsync(Guid id, UpdatePatientRelationDto input)
    {
        var relationship = await GetRelationshipAsync(id);
        relationship.Change(input.PatientId, input.Type, input.Note);
        await repository.UpdateAsync(relationship, autoSave: true);
        return await MapOneAsync(relationship, input.PatientId);
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Update)]
    public async Task DeleteAsync(Guid id)
    {
        await repository.DeleteAsync(await GetRelationshipAsync(id), autoSave: true);
    }

    private async Task<PatientRelationship> GetRelationshipAsync(Guid id)
    {
        var relationship = await repository.GetAsync(id);
        if (relationship.ClinicBranchId != branchResolver.GetRequiredClinicBranchId())
        {
            throw new EntityNotFoundException(typeof(PatientRelationship), id);
        }

        return relationship;
    }

    /// <summary>A record of the caller's branch; another branch's reads as missing.</summary>
    private async Task<Patient> GetPatientAsync(Guid patientId)
    {
        var patient = await patientRepository.GetAsync(patientId);
        if (patient.BranchId != branchResolver.GetRequiredClinicBranchId())
        {
            throw new EntityNotFoundException(typeof(Patient), patientId);
        }

        return patient;
    }

    private async Task<PatientRelationDto> MapOneAsync(PatientRelationship relationship, Guid seenFrom)
    {
        var type = relationship.TypeSeenFrom(seenFrom);
        var link = new PatientLink(relationship.OtherOf(seenFrom), PatientRelationSource.Relationship, type,
            PatientRelationTypes.IsFamily(type), relationship.Id, relationship.Note);
        return (await MapAsync([link])).Single();
    }

    private async Task<List<PatientRelationDto>> MapAsync(IReadOnlyCollection<PatientLink> links)
    {
        var ids = links.Select(l => l.OtherPatientId).Distinct().ToList();
        var patients = ids.Count == 0
            ? new Dictionary<Guid, Patient>()
            : (await patientRepository.GetListAsync(p => ids.Contains(p.Id))).ToDictionary(p => p.Id);

        return links
            .Where(l => patients.ContainsKey(l.OtherPatientId))
            .Select(l =>
            {
                var other = patients[l.OtherPatientId];
                return new PatientRelationDto
                {
                    Id = l.RelationshipId,
                    Source = l.Source,
                    GuardianDirection = l.GuardianDirection,
                    RelatedPatientId = other.Id,
                    RelatedPatientCode = other.PatientCode,
                    RelatedPatientName = other.FullName,
                    RelatedPatientGender = other.Gender,
                    RelatedPatientDateOfBirth = other.DateOfBirth,
                    Type = l.Type,
                    IsFamily = l.IsFamily,
                    Note = l.Note,
                };
            })
            .ToList();
    }
}
